/**
 * masterDataCache.js
 * In-memory client-side cache for stable master metadata (categories, locations,
 * evidence types, staff lists, academic years, student filters).
 *
 * Features:
 * - 5-minute TTL by default.
 * - Deduplicates concurrent in-flight requests for the same cache key.
 * - Listens to 'master-data:updated' window event and automatically clears cache when
 *   master data is created, edited, or deleted anywhere in the app.
 * - Clears cache on 'auth:logout' to ensure tenant isolation across user sessions.
 */

import { MASTER_DATA_UPDATED_EVENT } from '../hooks/useMasterDataListener';

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

class MasterDataCache {
    constructor() {
        this.cache = new Map();
        this.inFlight = new Map();
        this.setupListeners();
    }

    setupListeners() {
        if (typeof window === 'undefined') return;

        // Auto-invalidate cache on master data mutations
        window.addEventListener(MASTER_DATA_UPDATED_EVENT, () => {
            this.clear();
        });

        // Clear cache on logout for tenant isolation
        window.addEventListener('auth:logout', () => {
            this.clear();
        });
    }

    async fetch(key, fetcherFn, ttlMs = DEFAULT_TTL_MS) {
        if (!key || typeof fetcherFn !== 'function') {
            return fetcherFn ? fetcherFn() : null;
        }

        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < ttlMs) {
            return cached.data;
        }

        if (this.inFlight.has(key)) {
            return this.inFlight.get(key);
        }

        const promise = (async () => {
            try {
                const data = await fetcherFn();
                this.cache.set(key, { data, timestamp: Date.now() });
                return data;
            } catch (error) {
                this.cache.delete(key);
                throw error;
            } finally {
                this.inFlight.delete(key);
            }
        })();

        this.inFlight.set(key, promise);
        return promise;
    }

    invalidate(key) {
        if (key) {
            this.cache.delete(key);
            this.inFlight.delete(key);
        }
    }

    clear() {
        this.cache.clear();
        this.inFlight.clear();
    }
}

export const masterDataCache = new MasterDataCache();
export default masterDataCache;
