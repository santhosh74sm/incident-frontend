const DB_NAME = 'incident-tracking-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'createIncidentDrafts';
const KEY_PREFIX = 'createIncidentDraft';
const SESSION_KEY_PREFIX = `${KEY_PREFIX}:active:`;

let memoryDrafts = new Map();
let dbPromise = null;

const getUserId = (user) => String(user?._id || user?.id || '').trim();

const getSchoolScope = (user) => {
    const value =
        user?.schoolId ||
        user?.school ||
        user?.workspaceId ||
        user?.workspace?._id ||
        user?.workspace?.id ||
        user?.schoolName ||
        'current-school';

    return String(value).trim() || 'current-school';
};

export const getCreateIncidentDraftKey = (user) => {
    const userId = getUserId(user);
    if (!userId) return '';

    return `${KEY_PREFIX}:${encodeURIComponent(getSchoolScope(user))}:${encodeURIComponent(userId)}`;
};

const getSessionMarkerKey = (draftKey) => `${SESSION_KEY_PREFIX}${draftKey}`;

const getSessionStorage = () => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage || null;
};

const markSessionDraftActive = (draftKey) => {
    const storage = getSessionStorage();
    if (!storage || !draftKey) return;
    storage.setItem(getSessionMarkerKey(draftKey), 'true');
};

const isSessionDraftActive = (draftKey) => {
    const storage = getSessionStorage();
    if (!storage || !draftKey) return false;
    return storage.getItem(getSessionMarkerKey(draftKey)) === 'true';
};

const clearSessionDraftMarker = (draftKey) => {
    const storage = getSessionStorage();
    if (!storage || !draftKey) return;
    storage.removeItem(getSessionMarkerKey(draftKey));
};

const openDraftDb = () => {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
    });

    return dbPromise;
};

const readFromDb = async (draftKey) => {
    const db = await openDraftDb();
    if (!db) return null;

    return new Promise((resolve) => {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(draftKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
    });
};

const writeToDb = async (draftKey, draft) => {
    const db = await openDraftDb();
    if (!db) return;

    await new Promise((resolve) => {
        const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(draft, draftKey);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
    });
};

const removeFromDb = async (draftKey) => {
    const db = await openDraftDb();
    if (!db) return;

    await new Promise((resolve) => {
        const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(draftKey);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
    });
};

const clearDbDrafts = async () => {
    const db = await openDraftDb();
    if (!db) return;

    await new Promise((resolve) => {
        const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
    });
};

export const getCreateIncidentDraft = async (user) => {
    const draftKey = getCreateIncidentDraftKey(user);
    if (!draftKey || !isSessionDraftActive(draftKey)) return null;

    return memoryDrafts.get(draftKey) || (await readFromDb(draftKey));
};

export const setCreateIncidentDraft = async (user, draft) => {
    const draftKey = getCreateIncidentDraftKey(user);
    if (!draftKey) return;

    markSessionDraftActive(draftKey);
    memoryDrafts.set(draftKey, draft);
    await writeToDb(draftKey, draft);
};

export const clearCreateIncidentDraft = async (user) => {
    const draftKey = getCreateIncidentDraftKey(user);
    if (!draftKey) return;

    clearSessionDraftMarker(draftKey);
    memoryDrafts.delete(draftKey);
    await removeFromDb(draftKey);
};

export const clearAllCreateIncidentDrafts = async () => {
    memoryDrafts = new Map();

    const storage = getSessionStorage();
    if (storage) {
        const keysToRemove = [];
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (key?.startsWith(SESSION_KEY_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => storage.removeItem(key));
    }

    await clearDbDrafts();
};
