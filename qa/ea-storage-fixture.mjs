/** In-memory persistence fixtures. These do not claim real-browser coverage. */
export function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    key(index) { return [...data.keys()][index] ?? null; },
    get length() { return data.size; },
  };
}

/**
 * A small cooperating Web Locks model: a callback holds its named exclusive
 * lock until its returned promise settles. `ifAvailable` never queues.
 */
export function memoryLocks() {
  const held = new Map(), queued = new Map();
  function run(name, callback, resolve, reject) {
    const token = { name, mode: 'exclusive' };
    held.set(name, token);
    const release = () => {
      if (held.get(name) === token) held.delete(name);
      const next = queued.get(name)?.shift();
      if (next) run(name, ...next);
    };
    Promise.resolve().then(() => callback(token)).then(value => {
      release(); resolve(value);
    }, error => { release(); reject(error); });
  }
  return {
    request(name, options, callback) {
      if (typeof options === 'function') { callback = options; options = {}; }
      if (options?.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      return new Promise((resolve, reject) => {
        if (held.has(name)) {
          if (options?.ifAvailable) {
            Promise.resolve().then(() => callback(null)).then(resolve, reject);
          } else {
            if (!queued.has(name)) queued.set(name, []);
            queued.get(name).push([callback, resolve, reject]);
          }
        } else run(name, callback, resolve, reject);
      });
    },
    async query() {
      return { held: [...held.values()].map(x => ({ ...x })), pending: [...queued.entries()].flatMap(([name, queue]) => queue.map(() => ({ name, mode: 'exclusive' }))) };
    },
  };
}

export const flushMicrotasks = async () => {
  for (let index = 0; index < 6; index++) await Promise.resolve();
};
