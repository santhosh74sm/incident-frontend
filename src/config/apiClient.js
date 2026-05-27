/**
 * apiClient.js
 * Centralized Axios instance for all API communication.
 *
 * Features:
 * - baseURL from env with no trailing-slash normalization
 * - withCredentials: true for httpOnly cookie auth
 * - Global protected-route 401 interceptor -> auth cleanup + auth:logout event
 * - Automatic retry on transient errors (GET/HEAD/OPTIONS, max 2 retries)
 * - Named export for direct use: import apiClient from '../config/apiClient'
 */

import axios from 'axios';

const API_BASE = (
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_BASE ||
    'https://incident-backend-rzmq.onrender.com'
).replace(/\/$/, '');

axios.defaults.withCredentials = true;

const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ─── Retry helpers ───────────────────────────────────────────────────────────

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
const MAX_RETRIES = 2;
const PUBLIC_AUTH_PATHS = [
    '/api/auth/admin-exists',
    '/api/auth/bootstrap-status',
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/forgot-password',
    '/api/auth/verify-reset-otp',
    '/api/auth/reset-password',
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

apiClient.interceptors.request.use((config) => {
    if (isPublicAuthRequest(config)) {
        removeAuthHeader(config.headers);
    }

    return config;
});

// ─── Response interceptor ────────────────────────────────────────────────────

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401 && !isPublicAuthRequest(error.config)) {
            clearLegacyAuthState();
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('auth:logout'));
            }
        }

        const config = error.config || {};
        const method = String(config.method || 'get').toLowerCase();
        const status = error.response?.status;
        const retryCount = config.__retryCount || 0;

        const canRetry =
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
