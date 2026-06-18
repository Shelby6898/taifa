/*
|--------------------------------------------------------------------------
| SIMPLE IN-MEMORY CACHE
|--------------------------------------------------------------------------
| Suitable for a single-process deployment (Render WEB_CONCURRENCY=1).
| Do NOT rely on this if the app is ever scaled to multiple instances/
| processes - each instance would have its own separate cache, and writes
| in one instance would not invalidate cache entries in another.
*/

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlMs = null) {
  store.set(key, {
    value,
    expiresAt: ttlMs ? Date.now() + ttlMs : null
  });
}

function del(key) {
  store.delete(key);
}

// Delete all keys starting with a given prefix - useful for invalidating
// every cached variant of a report for a given orgId (e.g. different
// roles/departments produce different cached results for the same org).
function delPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

module.exports = { get, set, del, delPrefix };
