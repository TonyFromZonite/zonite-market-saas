const CACHE_VERSION = 'v1';
const CACHE_PREFIX = `zonite_${CACHE_VERSION}_`;

export const localCache = {
  set(key, data, ttlMinutes = 5) {
    const item = {
      data,
      expiry: Date.now() + ttlMinutes * 60 * 1000,
    };
    try {
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(item));
    } catch (e) {
      this.clearExpired();
    }
  },

  get(key) {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;
      const item = JSON.parse(raw);
      if (Date.now() > item.expiry) {
        localStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
      return item.data;
    } catch {
      return null;
    }
  },

  remove(key) {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  },

  clearExpired() {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (Date.now() > item.expiry) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    });
  },

  clearAll() {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  },
};
