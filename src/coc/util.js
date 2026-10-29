'use strict';
const { createHash, randomUUID } = require('node:crypto');
const { HttpError } = require('../http/errors');

const fail = (code, message, status = 409) => {
  throw new HttpError(status, code, message);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const stamp = () => new Date().toISOString();
const uid = () => randomUUID();
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function text(value, max = 500, allowEmpty = false) {
  if (
    typeof value !== 'string' ||
    [...value].length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    fail('COC_INVALID_TEXT', '文字格式或長度不正確', 400);
  const result = value.trim();
  if (!allowEmpty && !result) fail('COC_TEXT_REQUIRED', '請填寫內容', 400);
  return result;
}
function integer(value, min, max, code = 'COC_INVALID_NUMBER') {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail(code, '數值不在允許範圍內', 400);
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  );
}
const fingerprint = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
function requestId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9-]{8,80}$/.test(value))
    fail('COC_REQUEST_ID', '操作識別碼不正確，請更新畫面', 400);
  return value;
}
function ownKeys(value, keys) {
  if (!isRecord(value) || Object.keys(value).some((key) => !keys.includes(key)))
    fail('COC_INVALID_FIELDS', '請求包含不支援的欄位', 400);
}

module.exports = {
  fail,
  clone,
  stamp,
  uid,
  isRecord,
  text,
  integer,
  fingerprint,
  requestId,
  ownKeys,
};
