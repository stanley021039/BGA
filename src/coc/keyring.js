'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { transaction } = require('../db/index');
const { fail, stamp, text } = require('./util');
const { CocCli } = require('./cli-provider');
const { CocCliQueue } = require('./cli-queue');

const PROVIDERS = Object.freeze(['openai', 'anthropic']);
const DEFAULT_MODELS = Object.freeze({ openai: 'gpt-6.1-sol', anthropic: 'claude-sonnet-4-6' });
function providerName(value) {
  if (!PROVIDERS.includes(value)) fail('COC_PROVIDER', '僅支援 OpenAI 或 Claude', 400);
  return value;
}
function modelName(value, provider) {
  const model = value || DEFAULT_MODELS[provider];
  if (typeof model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(model))
    fail('COC_MODEL', '模型名稱格式不正確', 400);
  return model;
}

class CocKeyring {
  constructor(db, file, config = {}) {
    this.db = db;
    this.file = file;
    this.environment = config;
    this.cli = config.cliEnabled
      ? config.cliMode === 'ssh-worker'
        ? new CocCliQueue(config)
        : new CocCli(config)
      : null;
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    try {
      fs.writeFileSync(file, randomBytes(32), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Invalid COC keyring location');
    this.master = fs.readFileSync(file);
    if (this.master.length !== 32) throw Error('Invalid COC keyring');
    if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
  }

  encrypt(owner, scope, provider, secret) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.master, nonce);
    cipher.setAAD(Buffer.from([owner, scope, provider, 'v1'].join(':')));
    const bytes = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [
      'v1',
      nonce.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      bytes.toString('base64'),
    ].join('.');
  }

  decrypt(row) {
    try {
      const [version, nonce, tag, data] = row.encrypted_key.split('.');
      if (version !== 'v1') throw Error('Unsupported key version');
      const decipher = createDecipheriv('aes-256-gcm', this.master, Buffer.from(nonce, 'base64'));
      decipher.setAAD(Buffer.from([row.owner_id, row.scope, row.provider, 'v1'].join(':')));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      fail('COC_KEY_REENTER', '無法解密已保存的金鑰，請在 AI 設定中重新輸入', 503);
    }
  }

  describe(user) {
    const rows = this.db
      .prepare(
        'SELECT owner_id,scope,provider,model,suffix,enabled,updated_at FROM coc_provider_keys WHERE owner_id=? ORDER BY scope,provider',
      )
      .all(user.id);
    return {
      cli: this.cli
        ? this.cli.status()
        : { enabled: false, ready: false, message: '此站尚未啟用 CLI 主持', model: '' },
      providers: PROVIDERS.map((provider) => ({ id: provider, model: DEFAULT_MODELS[provider] })),
      canManageStation: user.role === 'admin',
      keys: rows
        .filter((row) => row.scope === 'user' || user.role === 'admin')
        .map((row) => ({
          scope: row.scope,
          provider: row.provider,
          model: row.model,
          suffix: row.suffix,
          enabled: row.enabled === 1,
          updatedAt: row.updated_at,
        })),
      station: PROVIDERS.map((provider) => ({
        provider,
        available: this.stationAvailable(provider),
      })),
    };
  }

  stationAvailable(provider) {
    const name = provider === 'openai' ? 'openaiApiKey' : 'anthropicApiKey';
    if (this.environment[name]) return true;
    return !!this.db
      .prepare(
        "SELECT 1 FROM coc_provider_keys k JOIN users u ON u.id=k.owner_id WHERE k.provider=? AND k.scope='station' AND k.enabled=1 AND u.role='admin' AND u.disabled=0",
      )
      .get(provider);
  }

  save(user, data) {
    const provider = providerName(data.provider);
    const scope = data.scope === 'station' ? 'station' : data.scope === 'user' ? 'user' : null;
    if (!scope) fail('COC_KEY_SCOPE', '請選擇本人或站方設定', 400);
    if (scope === 'station' && user.role !== 'admin')
      fail('COC_ADMIN_ONLY', '只有管理者可以設定站方 AI', 403);
    const model = modelName(data.model, provider);
    const secret = text(data.key, 300);
    if (secret.length < 20 || /\s/.test(secret)) fail('COC_KEY_FORMAT', 'API 金鑰格式不正確', 400);
    const encrypted = this.encrypt(user.id, scope, provider, secret);
    transaction(this.db, () => {
      // A station has one current owner per provider; replacing it revokes the
      // previous administrator's station entry without changing personal keys.
      if (scope === 'station')
        this.db
          .prepare("DELETE FROM coc_provider_keys WHERE scope='station' AND provider=?")
          .run(provider);
      this.db
        .prepare(
          `INSERT INTO coc_provider_keys(owner_id,scope,provider,model,encrypted_key,suffix,enabled,updated_at)
        VALUES(?,?,?,?,?,?,1,?) ON CONFLICT(owner_id,scope,provider) DO UPDATE SET
        model=excluded.model,encrypted_key=excluded.encrypted_key,suffix=excluded.suffix,enabled=1,updated_at=excluded.updated_at`,
        )
        .run(user.id, scope, provider, model, encrypted, secret.slice(-4), stamp());
    });
    return this.describe(user);
  }

  remove(user, data) {
    const provider = providerName(data.provider);
    if (!['user', 'station'].includes(data.scope)) fail('COC_KEY_SCOPE', '設定範圍不正確', 400);
    if (data.scope === 'station' && user.role !== 'admin')
      fail('COC_ADMIN_ONLY', '只有管理者可以刪除站方 AI 設定', 403);
    if (data.scope === 'station')
      this.db
        .prepare("DELETE FROM coc_provider_keys WHERE scope='station' AND provider=?")
        .run(provider);
    else
      this.db
        .prepare("DELETE FROM coc_provider_keys WHERE owner_id=? AND scope='user' AND provider=?")
        .run(user.id, provider);
    return this.describe(user);
  }

  resolve(hostUserId, source, provider) {
    providerName(provider);
    if (source === 'cli') {
      if (provider !== 'openai' || !this.cli)
        fail('COC_CLI_DISABLED', '此站尚未啟用 Codex CLI 主持', 409);
      return this.cli.credentials();
    }
    if (source === 'station') {
      const field = provider === 'openai' ? 'openaiApiKey' : 'anthropicApiKey';
      if (this.environment[field])
        return {
          provider,
          scope: 'station',
          ownerId: null,
          model: modelName(this.environment[provider + 'Model'], provider),
          key: this.environment[field],
        };
      const row = this.db
        .prepare(
          "SELECT k.* FROM coc_provider_keys k JOIN users u ON u.id=k.owner_id WHERE k.scope='station' AND k.provider=? AND k.enabled=1 AND u.role='admin' AND u.disabled=0 ORDER BY k.updated_at DESC LIMIT 1",
        )
        .get(provider);
      if (row)
        return {
          provider,
          scope: 'station',
          ownerId: row.owner_id,
          model: row.model,
          key: this.decrypt(row),
        };
    } else if (source === 'user') {
      const row = this.db
        .prepare(
          "SELECT k.* FROM coc_provider_keys k JOIN users u ON u.id=k.owner_id WHERE k.owner_id=? AND k.scope='user' AND k.provider=? AND k.enabled=1 AND u.disabled=0",
        )
        .get(hostUserId, provider);
      if (row)
        return {
          provider,
          scope: 'user',
          ownerId: hostUserId,
          model: row.model,
          key: this.decrypt(row),
        };
    } else fail('COC_AI_SOURCE', 'AI 費用來源不正確', 400);
    fail(
      'COC_AI_KEY_REQUIRED',
      source === 'station'
        ? '站方 AI 尚未設定，請房主切換自備金鑰或請管理者設定'
        : '請房主先在 AI 設定中保存本人金鑰',
      409,
    );
  }

  close() {
    this.cli?.close();
    this.master.fill(0);
  }
}

module.exports = { CocKeyring, PROVIDERS, DEFAULT_MODELS, providerName, modelName };
