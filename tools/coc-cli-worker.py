#!/usr/bin/env python3
"""Operator-started SSH transport for the official, ChatGPT-authenticated Codex CLI.

Uses only Python's standard library and an existing SSH connection. Credentials
stay with the CLI; this process never reads or transfers its authentication file.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import time
import uuid


REMOTE = r'''
import base64,fcntl,json,os,re,time
from pathlib import Path
v=json.loads(base64.b64decode(PAYLOAD))
r=Path(v['root']);r.mkdir(mode=0o700,parents=True,exist_ok=True)
os.chmod(r,0o700);jobs=r/'jobs';jobs.mkdir(mode=0o700,exist_ok=True)
with (r/'lease.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 now=int(time.time()*1000);status=r/'status.json';old={}
 try:
  if status.stat().st_size<=4096:old=json.loads(status.read_text())
 except (OSError,ValueError):pass
 if old.get('workerId')!=v['workerId'] and old.get('authenticated') and now-old.get('at',0)<15000:
  print(json.dumps({'error':'lease_busy'}));raise SystemExit()
 new={'protocol':1,'workerId':v['workerId'],'at':now,'authenticated':v['online'],'model':v['model']}
 tmp=r/'status.tmp';tmp.write_text(json.dumps(new));os.chmod(tmp,0o600);tmp.replace(status)
 active=v.get('active');cancelled=False
 if active:
  p=jobs/active
  cancelled=not p.is_dir() or (p/'cancelled').exists()
  if not cancelled and v.get('response'):
   q=p/'response.tmp';q.write_text(json.dumps(v['response']));os.chmod(q,0o600);q.replace(p/'response.json')
 request=None
 if v['online'] and not active:
  for p in sorted(jobs.iterdir()):
   if not p.is_dir() or p.is_symlink() or not re.fullmatch(r'[a-f0-9-]{36}',p.name):continue
   f=p/'request.json'
   if (p/'claimed').exists() or (p/'cancelled').exists() or not f.is_file() or f.stat().st_size>131072:continue
   try:q=json.loads(f.read_text())
   except (OSError,ValueError):continue
   if q.get('protocol')!=1 or q.get('id')!=p.name or q.get('workerId')!=v['workerId'] or q.get('model')!=v['model'] or q.get('expiresAt',0)<=now:continue
   fd=os.open(p/'claimed',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600);os.close(fd)
   request=q;break
 print(json.dumps({'request':request,'cancelled':cancelled}))
'''


class WorkerError(Exception):
    pass


class Worker:
    def __init__(self, config):
        self.host = config['host']
        self.root = config['queueRoot']
        self.model = config.get('model', 'gpt-6.1-sol')
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.@:-]{0,199}', self.host):
            raise ValueError('Invalid SSH destination')
        if not self.root.startswith('/') or self.root == '/' or '..' in self.root.split('/'):
            raise ValueError('queueRoot must be a private absolute VM directory')
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{0,99}', self.model):
            raise ValueError('Invalid model')
        self.cli = config.get('cli') or shutil.which('codex')
        if not self.cli or not Path(self.cli).is_file():
            raise ValueError('Official Codex CLI executable not found')
        self.state = Path(config.get('stateDir', str(Path.home() / '.codex/private/coc-keeper'))).resolve()
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.stop_file = Path(config.get('stopFile', str(self.state / 'stop'))).resolve()
        self.identifier = str(uuid.uuid4())
        self.proc = None
        self.port = int(config.get('sshPort', 22))
        if not 1 <= self.port <= 65535:
            raise ValueError('Invalid SSH port')

    def exchange(self, active=None, response=None, online=True):
        payload = {'root': self.root, 'workerId': self.identifier, 'model': self.model,
                   'online': online, 'active': active, 'response': response}
        encoded = base64.b64encode(json.dumps(payload).encode()).decode()
        script = REMOTE.replace('PAYLOAD', repr(encoded))
        packed = base64.b64encode(script.encode()).decode()
        command = "printf '%s' '" + packed + "' | base64 -d | python3"
        result = subprocess.run(['ssh', '-p', str(self.port), '-o', 'BatchMode=yes',
                                 '-o', 'ConnectTimeout=5', self.host, command],
                                capture_output=True, timeout=8)
        if result.returncode or len(result.stdout) > 140000:
            raise WorkerError('SSH transport unavailable')
        answer = json.loads(result.stdout)
        if answer.get('error'):
            raise WorkerError('Another CLI worker already holds this queue')
        return answer

    def login_ready(self):
        result = subprocess.run([self.cli, 'login', 'status'], capture_output=True, timeout=10)
        return result.returncode == 0 and b'chatgpt' in (result.stdout + result.stderr).lower()

    def stop_process(self):
        if not self.proc or self.proc.poll() is not None:
            return
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(self.proc.pid), '/T', '/F'],
                           capture_output=True, timeout=8)
        else:
            os.killpg(self.proc.pid, signal.SIGKILL)
        self.proc.wait(timeout=10)

    def infer(self, request):
        identifier = request['id']
        if not re.fullmatch(r'[a-f0-9-]{36}', identifier):
            raise WorkerError('Invalid request identifier')
        if not isinstance(request.get('prompt'), str) or not isinstance(request.get('schema'), dict):
            return {'error': 'COC_AI_OUTPUT'}
        job = self.state / str(uuid.uuid4())
        job.mkdir(mode=0o700)
        try:
            schema = job / 'schema.json'
            schema.write_text(json.dumps(request['schema']), encoding='utf-8')
            output = job / 'result.json'
            args = [self.cli, 'exec', '--ignore-user-config', '--ignore-rules', '--ephemeral',
                    '--json', '--skip-git-repo-check', '--sandbox', 'read-only', '--model', self.model,
                    '--output-schema', str(schema), '--output-last-message', str(output),
                    '--color', 'never', '-C', str(job)]
            settings = {'approval_policy': 'never', 'forced_login_method': 'chatgpt',
                        'model_reasoning_effort': 'low', 'model_verbosity': 'low',
                        'web_search': 'disabled', 'project_doc_max_bytes': 0, 'mcp_servers': {}}
            for feature in ['shell_tool', 'apps', 'hooks', 'multi_agent', 'remote_plugin',
                            'shell_snapshot', 'memories', 'goals']:
                settings['features.' + feature] = False
            for key, value in settings.items():
                args += ['-c', key + '=' + json.dumps(value)]
            args += ['-']
            env = dict(os.environ)
            for key in ['OPENAI_API_KEY', 'CODEX_API_KEY', 'CODEX_ACCESS_TOKEN']:
                env.pop(key, None)
            started = time.monotonic()
            stdout_path, stderr_path = job / 'events.jsonl', job / 'errors.txt'
            with stdout_path.open('wb') as stdout, stderr_path.open('wb') as stderr:
                self.proc = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=stdout, stderr=stderr,
                                             cwd=job, env=env, start_new_session=os.name != 'nt')
                self.proc.stdin.write(request['prompt'].encode())
                self.proc.stdin.close()
                while self.proc.poll() is None:
                    if self.stop_file.exists() or time.monotonic() - started > 75:
                        raise WorkerError('COC_AI_UNCERTAIN')
                    if stdout_path.stat().st_size + stderr_path.stat().st_size > 1048576:
                        raise WorkerError('COC_AI_OUTPUT')
                    if self.exchange(active=identifier)['cancelled']:
                        raise WorkerError('COC_AI_UNCERTAIN')
                    time.sleep(1)
            if stdout_path.stat().st_size + stderr_path.stat().st_size > 1048576:
                return {'error': 'COC_AI_OUTPUT'}
            if self.proc.returncode:
                detail = (stdout_path.read_bytes() + stderr_path.read_bytes()).decode('utf-8', errors='replace')
                if re.search(r'usage_limit|rate.limit|quota|limit reached', detail, re.I):
                    return {'error': 'COC_CLI_LIMIT'}
                if re.search(r'unauthorized|not logged in|401|token.*expired', detail, re.I):
                    return {'error': 'COC_CLI_LOGIN_REQUIRED'}
                return {'error': 'COC_CLI_FAILED', 'diagnostic': {'exitCode': self.proc.returncode}}
            if not output.is_file() or output.stat().st_size > 65536:
                return {'error': 'COC_AI_OUTPUT'}
            value = json.loads(output.read_text(encoding='utf-8'))
            usage = {'input': None, 'output': None}
            for line in stdout_path.read_text(encoding='utf-8').splitlines():
                event = json.loads(line)
                if event.get('type') == 'turn.completed':
                    raw = event.get('usage') or {}
                    for name in ['input', 'output']:
                        number = raw.get(name + '_tokens')
                        usage[name] = number if type(number) is int and number >= 0 else None
            return {'result': {'value': value, 'usage': usage, 'model': self.model}}
        except (ValueError, OSError):
            return {'error': 'COC_AI_OUTPUT'}
        except WorkerError as error:
            code = str(error)
            return {'error': code if code in ['COC_AI_UNCERTAIN', 'COC_AI_OUTPUT'] else 'COC_AI_UNCERTAIN'}
        finally:
            self.stop_process()
            self.proc = None
            # This UUID directory was created by this invocation under stateDir.
            shutil.rmtree(job)

    def run(self, max_requests, max_minutes):
        if not self.login_ready():
            raise WorkerError('Run codex login on this computer using ChatGPT, then start again')
        started, count = time.monotonic(), 0
        self.exchange()
        print('CLI_KEEPER_CONNECTED (Ctrl+C to disconnect)', flush=True)
        try:
            while not self.stop_file.exists() and count < max_requests and time.monotonic() - started < max_minutes * 60:
                request = self.exchange()['request']
                if request is None:
                    time.sleep(0.7)
                    continue
                result = self.infer(request)
                response = {'protocol': 1, 'id': request['id'], 'workerId': self.identifier, **result}
                self.exchange(active=request['id'], response=response)
                count += 1
                print(json.dumps({'completed': count, 'error': result.get('error'),
                                  'usage': result.get('result', {}).get('usage'), 'diagnostic': result.get('diagnostic')}), flush=True)
                if result.get('error') == 'COC_CLI_LOGIN_REQUIRED':
                    raise WorkerError('Refresh the official CLI ChatGPT login on this computer, then restart')
        finally:
            self.stop_process()
            try:
                self.exchange(online=False)
            except (WorkerError, subprocess.SubprocessError, OSError):
                pass
            print('CLI_KEEPER_DISCONNECTED', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, help='Private operator JSON configuration')
    parser.add_argument('--max-requests', type=int, default=200)
    parser.add_argument('--max-minutes', type=int, default=240)
    args = parser.parse_args()
    if not 1 <= args.max_requests <= 1000 or not 1 <= args.max_minutes <= 1440:
        parser.error('Use 1–1000 requests and 1–1440 minutes')
    try:
        Worker(json.loads(Path(args.config).read_text(encoding='utf-8-sig'))).run(args.max_requests, args.max_minutes)
    except KeyboardInterrupt:
        pass
    except (WorkerError, ValueError, KeyError, OSError, subprocess.SubprocessError) as error:
        # Exceptions contain only local validation/transport details, never CLI output.
        print('CLI keeper stopped: ' + str(error), flush=True)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
