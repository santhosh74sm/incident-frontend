import axios from 'axios';

const DEFAULT_API_BASE =
    process.env.NODE_ENV === 'development'
        ? 'http://localhost:5000'
        : 'https://incident-backend-rzmq.onrender.com';

const API_BASE = (
    process.env.REACT_APP_API_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_BASE ||
    DEFAULT_API_BASE
).replace(/\/$/, '');

if (process.env.NODE_ENV === 'development') {
    // Visible only in local dev builds; confirms localhost vs Render before any request leaves the browser.
    console.info('[apiClient] API base URL:', API_BASE);
}

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
const CSRF_PATH = '/api/auth/csrf';
const CSRF_FALLBACK_PATH = '/api/auth/csrf-token';
const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_METHODS = new Set(['post', 'put', 'patch', 'delete']);

const PUBLIC_AUTH_PATHS = [
    '/api/auth/admin-exists',
    '/api/auth/bootstrap-status',
    '/api/auth/csrf',
    '/api/auth/csrf-token',
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
let csrfTokenMemory = '';
let csrfPromise = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeResponseIds = (value, seen = new WeakSet()) => {
    if (value == null || typeof value !== 'object') return value;

    if (Array.isArray(value)) {
        value.forEach((item) => normalizeResponseIds(item, seen));
        return value;
    }

    if (seen.has(value)) return value;
    seen.add(value);

    if (value.id != null && value._id == null) {
        value._id = value.id;
    }

    Object.values(value).forEach((entry) => normalizeResponseIds(entry, seen));
    return value;
};

export const getPublicId = (value) => {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    return String(value.id ?? value._id ?? '');
};

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
const isCsrfRequest = (config = {}) => [CSRF_PATH, CSRF_FALLBACK_PATH].includes(getRequestPath(config));
const isAccessTokenExpired = (error) => error.response?.data?.code === 'ACCESS_TOKEN_EXPIRED';
const isRefreshRaceGrace = (error) => error.response?.data?.code === 'REFRESH_RETRY_GRACE';

const getCookieValue = (name) => {
    if (typeof document === 'undefined') return '';
    return document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`))
        ?.split('=')
        .slice(1)
        .join('=') || '';
};

const rememberCsrfToken = (headers = {}) => {
    const token =
        headers.get?.('x-csrf-token') ||
        headers['x-csrf-token'] ||
        headers['X-CSRF-Token'];
    if (token) csrfTokenMemory = token;
};

const ensureCsrfToken = async () => {
    const cookieToken = decodeURIComponent(getCookieValue(CSRF_COOKIE_NAME));
    if (csrfTokenMemory || cookieToken) return csrfTokenMemory || cookieToken;

    if (!csrfPromise) {
        csrfPromise = axios
            .get(`${API_BASE}${CSRF_PATH}`, { withCredentials: true })
            .catch((error) => {
                if (error.response?.status === 404) {
                    return axios.get(`${API_BASE}${CSRF_FALLBACK_PATH}`, { withCredentials: true });
                }
                throw error;
            })
            .then((response) => {
                rememberCsrfToken(response.headers);
                const token = csrfTokenMemory || response.data?.csrfToken || '';
                if (!token) {
                    throw new Error('CSRF bootstrap did not return a token.');
                }
                return token;
            })
            .finally(() => {
                csrfPromise = null;
            });
    }

    return csrfPromise;
};

const removeAuthHeader = (headers) => {
    if (!headers) return;

    delete headers.Authorization;
    delete headers.authorization;
};

const removeContentTypeHeader = (headers) => {
    if (!headers) return;
    headers.delete?.('Content-Type');
    delete headers['Content-Type'];
    delete headers['content-type'];
};

export const clearLegacyAuthState = () => {
    removeAuthHeader(apiClient.defaults.headers.common);
    removeAuthHeader(axios.defaults.headers.common);
    csrfTokenMemory = '';
    csrfPromise = null;

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
    if (process.env.NODE_ENV === 'development') {
        const target = new URL(config.url || '', config.baseURL || API_BASE).toString();
        console.info('[apiClient] request:', String(config.method || 'get').toUpperCase(), target);
    }

    if (isPublicAuthRequest(config)) {
        removeAuthHeader(config.headers);
    }

    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        removeContentTypeHeader(config.headers);
    }

    const method = String(config.method || 'get').toLowerCase();
    if (CSRF_METHODS.has(method) && !isCsrfRequest(config)) {
        const csrfToken = await ensureCsrfToken();
        if (csrfToken) {
            config.headers = config.headers || {};
            config.headers.set?.(CSRF_HEADER_NAME, csrfToken);
            config.headers[CSRF_HEADER_NAME] = csrfToken;
        }
    }

    return config;
});

apiClient.interceptors.response.use(
    (response) => {
        rememberCsrfToken(response.headers);
        normalizeResponseIds(response.data);
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
                if (isRefreshRaceGrace(refreshError)) {
                    await wait(250);
                    resetAuthEventGuard();
                    return apiClient(config);
                }

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
