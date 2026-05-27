const INCIDENT_KEY_PREFIXES = ['readIncidents', 'priorityIncidents'];
const MAX_STORED_IDS = 500;

const parseList = (value) => {
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
        return [];
    }
};

export const getUserScopedKey = (key, userId) => `${key}:${userId || 'anonymous'}`;

export const readUserList = (key, userId) => {
    if (typeof window === 'undefined' || !userId) return [];
    return parseList(window.localStorage.getItem(getUserScopedKey(key, userId)));
};

export const writeUserList = (key, userId, ids) => {
    if (typeof window === 'undefined' || !userId) return;

    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean).map(String))];
    const prunedIds = uniqueIds.slice(-MAX_STORED_IDS);
    window.localStorage.setItem(getUserScopedKey(key, userId), JSON.stringify(prunedIds));
};

export const migrateIncidentStorageForUser = (userId) => {
    if (typeof window === 'undefined' || !userId) return;

    INCIDENT_KEY_PREFIXES.forEach((key) => {
        const scopedKey = getUserScopedKey(key, userId);
        const scopedIds = parseList(window.localStorage.getItem(scopedKey));
        const legacyIds = parseList(window.localStorage.getItem(key));
        if (legacyIds.length > 0) {
            writeUserList(key, userId, [...scopedIds, ...legacyIds]);
            window.localStorage.removeItem(key);
        }
    });
};

export const pruneIncidentStorage = (activeUserId) => {
    if (typeof window === 'undefined') return;

    INCIDENT_KEY_PREFIXES.forEach((key) => {
        const activeKey = activeUserId ? getUserScopedKey(key, activeUserId) : null;
        const staleKeys = [];

        for (let index = 0; index < window.localStorage.length; index += 1) {
            const storageKey = window.localStorage.key(index);
            if (storageKey?.startsWith(`${key}:`) && storageKey !== activeKey) {
                staleKeys.push(storageKey);
            }
        }

        staleKeys.slice(5).forEach((storageKey) => window.localStorage.removeItem(storageKey));

        if (activeKey) {
            writeUserList(key, activeUserId, parseList(window.localStorage.getItem(activeKey)));
        }
    });
};
