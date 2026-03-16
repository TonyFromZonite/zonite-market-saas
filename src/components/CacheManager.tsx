import React from "react";

const CACHE_VERSION = 'v1';
const CACHE_TTL: Record<string, number> = {
  PRODUITS: 30 * 60 * 1000,
  VENDEURS: 60 * 60 * 1000,
  COMMANDES: 5 * 60 * 1000,
  VENTES: 10 * 60 * 1000,
  NOTIFICATIONS: 2 * 60 * 1000,
  STATS: 15 * 60 * 1000,
  COMPTE_VENDEUR: 3 * 60 * 1000,
};

class CacheStore {
  memory: Map<string, any>;
  hits: number;
  misses: number;

  constructor() {
    this.memory = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  generateKey(entity: string, params: Record<string, any> = {}) {
    const sortedParams = Object.keys(params).sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`).join('&');
    return `${CACHE_VERSION}:${entity}:${sortedParams}`;
  }

  set(entity: string, data: any, params: Record<string, any> = {}) {
    const key = this.generateKey(entity, params);
    const entry = {
      data,
      timestamp: Date.now(),
      ttl: CACHE_TTL[entity] || 5 * 60 * 1000,
      size: JSON.stringify(data).length,
    };
    this.memory.set(key, entry);
    try {
      if (entry.size < 100000) localStorage.setItem(key, JSON.stringify(entry));
    } catch { this.pruneExpired(); }
  }

  get(entity: string, params: Record<string, any> = {}) {
    const key = this.generateKey(entity, params);
    let entry = this.memory.get(key);
    if (!entry) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) { entry = JSON.parse(stored); this.memory.set(key, entry); }
      } catch { localStorage.removeItem(key); }
    }
    if (entry && Date.now() - entry.timestamp < entry.ttl) { this.hits++; return entry.data; }
    if (entry) this.delete(entity, params);
    this.misses++;
    return null;
  }

  delete(entity: string, params: Record<string, any> = {}) {
    const key = this.generateKey(entity, params);
    this.memory.delete(key);
    try { localStorage.removeItem(key); } catch {}
  }

  pruneExpired() {
    const now = Date.now();
    Object.keys(localStorage).forEach(key => {
      if (!key.startsWith(CACHE_VERSION)) return;
      try {
        const entry = JSON.parse(localStorage.getItem(key) || '');
        if (now - entry.timestamp > entry.ttl) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    });
  }

  clearAll() {
    this.memory.clear();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_VERSION)) localStorage.removeItem(key);
    });
  }
}

export const cacheStore = new CacheStore();

interface CachedQueryOptions {
  params?: Record<string, any>;
  ttl?: number;
  refetchInterval?: number | null;
  enabled?: boolean;
}

export function useCachedQuery(entity: string, queryFn: () => Promise<any>, options: CachedQueryOptions = {}) {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { params = {}, refetchInterval = null, enabled = true } = options;

  React.useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      const cached = cacheStore.get(entity, params);
      if (cached) {
        if (isMounted) { setData(cached); setLoading(false); }
        return;
      }
      try {
        setLoading(true);
        const result = await Promise.race([
          queryFn(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 8000)),
        ]);
        if (isMounted) { cacheStore.set(entity, result, params); setData(result); setError(null); }
      } catch (err: any) {
        if (isMounted) { setError(err.message); setData(null); }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    if (refetchInterval) intervalId = setInterval(fetchData, refetchInterval);
    return () => { isMounted = false; if (intervalId) clearInterval(intervalId); };
  }, [entity, JSON.stringify(params), enabled]);

  return { data, loading, error, isLoading: loading };
}

export function invalidateQuery(entity: string, params: Record<string, any> = {}) {
  cacheStore.delete(entity, params);
}
