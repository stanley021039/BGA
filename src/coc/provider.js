'use strict';
const { fail, isRecord } = require('./util');

// Fixed provider origins: a model name must never become an arbitrary URL.
async function structuredCall(
  credentials,
  { name, schema, instructions, input, maxTokens = 1800, signal },
) {
  if (credentials.transport === 'codex-cli')
    return credentials.cli.run({ name, schema, instructions, input, maxTokens, signal });
  const openai = credentials.provider === 'openai';
  const timeout = AbortSignal.timeout(60000);
  const body = openai
    ? {
        model: credentials.model,
        store: false,
        instructions,
        input: typeof input === 'string' ? input : JSON.stringify(input),
        max_output_tokens: maxTokens,
        ...(credentials.model === 'gpt-6.1-sol' ? { reasoning: { effort: 'low' } } : {}),
        text: { format: { type: 'json_schema', name, strict: true, schema } },
      }
    : {
        model: credentials.model,
        max_tokens: maxTokens,
        system: instructions,
        messages: [
          { role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) },
        ],
        output_config: { format: { type: 'json_schema', schema } },
      };
  let response;
  try {
    response = await fetch(
      openai ? 'https://api.openai.com/v1/responses' : 'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        redirect: 'error',
        headers: openai
          ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + credentials.key }
          : {
              'Content-Type': 'application/json',
              'x-api-key': credentials.key,
              'anthropic-version': '2023-06-01',
            },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      },
    );
  } catch {
    fail('COC_AI_UNCERTAIN', 'AI 連線中斷或逾時；已保存的擲骰與資源不會重算。請稍後重試。', 503);
  }
  if (!response.ok) {
    await response.body?.cancel();
    const code = [401, 403].includes(response.status)
      ? 'COC_AI_CREDENTIALS'
      : response.status === 429
        ? 'COC_AI_LIMIT'
        : 'COC_AI_PROVIDER';
    const message =
      code === 'COC_AI_CREDENTIALS'
        ? 'AI 金鑰或模型權限無法使用，請檢查設定'
        : code === 'COC_AI_LIMIT'
          ? 'AI 供應商額度不足或流量受限，請檢查帳戶後重試'
          : 'AI 供應商無法完成請求，請檢查模型名稱後重試';
    fail(code, message, 503);
  }
  let bytes = 0;
  const chunks = [];
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 262144) throw Error('Response too large');
      chunks.push(chunk);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (openai && result.status !== 'completed') throw Error('Incomplete');
    if (!openai && result.stop_reason !== 'end_turn') throw Error('Incomplete');
    const texts = openai
      ? (result.output || [])
          .flatMap((item) => (item.type === 'message' ? item.content || [] : []))
          .filter((part) => part.type === 'output_text')
          .map((part) => part.text)
      : (result.content || []).filter((part) => part.type === 'text').map((part) => part.text);
    const value = JSON.parse(texts.join(''));
    if (!isRecord(value)) throw Error('Invalid output');
    return {
      value,
      model: credentials.model,
      usage: {
        input:
          Number.isSafeInteger(result.usage?.input_tokens) && result.usage.input_tokens >= 0
            ? result.usage.input_tokens
            : null,
        output:
          Number.isSafeInteger(result.usage?.output_tokens) && result.usage.output_tokens >= 0
            ? result.usage.output_tokens
            : null,
      },
    };
  } catch {
    fail('COC_AI_OUTPUT', 'AI 回覆未完成或格式無效；已保存的結果保持不變，可重試敘事。', 503);
  }
}

async function probe(keyring, user, data) {
  if (['station', 'cli'].includes(data.scope) && user.role !== 'admin')
    fail('COC_ADMIN_ONLY', '只有管理者可以測試站方設定', 403);
  const credentials = keyring.resolve(user.id, data.scope, data.provider);
  const result = await structuredCall(credentials, {
    name: 'coc_connection_probe',
    schema: {
      type: 'object',
      properties: { ready: { type: 'boolean' } },
      required: ['ready'],
      additionalProperties: false,
    },
    instructions: 'This is an API connectivity check. Return ready true.',
    input: 'Check connection.',
    maxTokens: 1200,
  });
  if (result.value.ready !== true) fail('COC_AI_OUTPUT', 'AI 測試未完成，請重試', 503);
  return { ok: true, provider: credentials.provider, model: result.model, usage: result.usage };
}
module.exports = { structuredCall, probe };
