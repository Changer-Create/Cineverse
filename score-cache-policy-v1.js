(() => {
  'use strict';
  if (window.CineverseScoreCachePolicy) return;

  const SUCCESS_TTL = 7 * 24 * 60 * 60 * 1000;
  const FAILURE_BACKOFF = 30 * 1000;

  const validScore = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 && number <= 10 ? number : null;
  };

  function normalizeRow(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const score = validScore(row.score);
    if (row.status === 'success' && score != null) return { ...row, score, status:'success' };
    if (row.status === 'empty' && Number(row.expiresAt) > 0) return { ...row, score:null, status:'empty' };
    if (row.status === 'error' && Number(row.retryAt) > 0) return { ...row, score:null, status:'error' };
    // Legacy null/0 rows represented an unverified result and must be retried.
    if (!row.status && score != null && Number(row.expiresAt) > 0) return { ...row, score, status:'success' };
    return null;
  }

  function read(cache, key, now = Date.now()) {
    const row = normalizeRow(cache?.[key]);
    if (!row) return { kind:'miss', row:null };
    if (row.status === 'error') {
      return row.retryAt > now ? { kind:'backoff', row } : { kind:'miss', row };
    }
    if (Number(row.expiresAt) < now) return { kind:'miss', row };
    return row.status === 'success'
      ? { kind:'success', score:row.score, row }
      : { kind:'empty', score:null, row };
  }

  function writeSuccess(cache, key, score, now = Date.now(), ttl = SUCCESS_TTL) {
    if (!key) return cache;
    cache[key] = { status:'success', score:validScore(score), expiresAt:now + ttl };
    return cache;
  }

  function writeEmpty(cache, key, now = Date.now(), ttl = SUCCESS_TTL) {
    if (!key) return cache;
    cache[key] = { status:'empty', score:null, expiresAt:now + ttl };
    return cache;
  }

  function writeFailure(cache, key, now = Date.now(), backoff = FAILURE_BACKOFF) {
    if (!key) return cache;
    const previous = normalizeRow(cache[key]);
    if (previous?.status === 'success' && Number(previous.expiresAt) >= now) return cache;
    cache[key] = { status:'error', score:null, retryAt:now + backoff, expiresAt:now + backoff };
    return cache;
  }

  function prune(cache, limit = 500, keep = 450) {
    const keys = Object.keys(cache || {});
    if (keys.length <= limit) return cache;
    keys.sort((a,b) => Number(cache[b]?.expiresAt || cache[b]?.retryAt || 0) - Number(cache[a]?.expiresAt || cache[a]?.retryAt || 0));
    for (const key of keys.slice(keep)) delete cache[key];
    return cache;
  }

  window.CineverseScoreCachePolicy = Object.freeze({
    SUCCESS_TTL, FAILURE_BACKOFF, validScore, normalizeRow, read,
    writeSuccess, writeEmpty, writeFailure, prune
  });
})();