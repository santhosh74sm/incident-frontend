import axios from 'axios';

const DEFAULT_API_BASE =
    process.env.NODE_ENV === 'development'
        ? 'http://localhost:5000'
        : 'https://incident-backend-rzmq.onrender.com';

const API_BASE = (
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_BASE ||
    DEFAULT_API_BASE
).replace(/\/$/, '');

axios.defaults.withCredentials = true;

const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const MAX_RETRIES = 2;
const AUTH_RESTORE_PATH = '/api/auth/me';
const REFRESH_PATH = '/api/auth/refresh';

const PUBLIC_AUTH_PATHS = [
    '/api/auth/admin-exists',
    '/api/auth/bootstrap-status',
    '/api/auth/register',
    '/api/auth/login',
];

const LEGACY_AUTH_STORAGE_KEYS = [
    'token',
    'authToken',
    'jwt',
    'user',
    'currentUser',
    'incident-tracking-auth',
    'incident-tracking-user',
];

let logoutDispatched = false;
let refreshPromise = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRequestPath = (config = {}) => {
    const rawUrl = config.url || '';

    try {
        return new URL(rawUrl, config.baseURL || API_BASE).pathname;
    } catch {
        return rawUrl.split('?')[0];
    }
};

const isPublicAuthRequest = (config = {}) => PUBLIC_AUTH_PATHS.includes(getRequestPath(config));
const isAuthRestoreRequest = (config = {}) => getRequestPath(config) === AUTH_RESTORE_PATH;
const isRefreshRequest = (config = {}) => getRequestPath(config) === REFRESH_PATH;
const isAccessTokenExpired = (error) => error.response?.data?.code === 'ACCESS_TOKEN_EXPIRED';

const removeAuthHeader = (headers) => {
    if (!headers) return;

    delete headers.Authorization;
    delete headers.authorization;
};

export const clearLegacyAuthState = () => {
    removeAuthHeader(apiClient.defaults.headers.common);
    removeAuthHeader(axios.defaults.headers.common);

    if (typeof window === 'undefined') return;

    LEGACY_AUTH_STORAGE_KEYS.forEach((key) => {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
    });
};

export const resetAuthEventGuard = () => {
    logoutDispatched = false;
};

const dispatchAuthLogout = (reason = 'session-invalid') => {
    if (logoutDispatched || typeof window === 'undefined') return;

    logoutDispatched = true;
    window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason } }));
};

const refreshSession = async () => {
    if (!refreshPromise) {
        refreshPromise = apiClient
            .post(REFRESH_PATH, {}, { __skipAuthLogout: true })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
};

apiClient.interceptors.request.use(async (config) => {
    if (isPublicAuthRequest(config)) {
        removeAuthHeader(config.headers);
    }

    return config;
});

apiClient.interceptors.response.use(
    (response) => {
        if (response.config && !isAuthRestoreRequest(response.config)) {
            resetAuthEventGuard();
        }
        return response;
    },
    async (error) => {
        const config = error.config || {};
        const status = error.response?.status;
        if (
            status === 401 &&
            isAccessTokenExpired(error) &&
            !config.__refreshRetried &&
            !isPublicAuthRequest(config) &&
            !isRefreshRequest(config)
        ) {
            try {
                config.__refreshRetried = true;
                await refreshSession();
                resetAuthEventGuard();
                return apiClient(config);
            } catch (refreshError) {
                clearLegacyAuthState();
                dispatchAuthLogout(refreshError.response?.data?.code || 'refresh-failed');
                return Promise.reject(refreshError);
            }
        }

        if (
            status === 401 &&
            !config.__skipAuthLogout &&
            !isPublicAuthRequest(config)
        ) {
            clearLegacyAuthState();
            dispatchAuthLogout(error.response?.data?.code || 'session-invalid');
        }

        const method = String(config.method || 'get').toLowerCase();
        const retryCount = config.__retryCount || 0;
        const canRetry =
            status !== 401 &&
            RETRYABLE_METHODS.has(method) &&
            (!status || RETRYABLE_STATUSES.has(status)) &&
            retryCount < MAX_RETRIES;

        if (!canRetry) {
            return Promise.reject(error);
        }

        config.__retryCount = retryCount + 1;

        const retryAfterHeader = Number(error.response?.headers?.['retry-after']);
        const delay = Number.isFinite(retryAfterHeader)
            ? retryAfterHeader * 1000
            : 500 * config.__retryCount;

        await wait(delay);
        return apiClient(config);
    }
);

export { API_BASE };
export default apiClient;
