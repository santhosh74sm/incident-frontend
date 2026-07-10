import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import apiClient, { clearLegacyAuthState, resetAuthEventGuard } from '../config/apiClient';
import { clearAllCreateIncidentDrafts } from '../utils/createIncidentDraftStore';

const AuthContext = createContext({
    user: null,
    loading: true,
    authReady: false,
    authRestoreError: null,
    login: () => {},
    logout: async () => {},
    restoreAuth: async () => {},
});

const PRIVATE_TENANT_FIELD = ['school', 'Id'].join('');
const AUTH_RESTORE_TIMEOUT_MS = 15000;
let restoreAuthRequest = null;

const sanitizeUser = (value) => {
    if (!value || typeof value !== 'object') return value || null;
    const user = { ...value };
    delete user[PRIVATE_TENANT_FIELD];
    return user;
};

const fetchCurrentUser = (signal, authRevision) => {
    if (!restoreAuthRequest || restoreAuthRequest.authRevision !== authRevision) {
        const request = apiClient
            .get('/api/auth/me', {
                __skipAuthLogout: true,
                // This request is already coalesced below for one auth session.
                // It must never reuse a completed response from a prior session.
                __skipDedupe: true,
                signal,
                headers: {
                    'Cache-Control': 'no-store',
                },
            })
            .finally(() => {
                if (restoreAuthRequest?.promise === request) {
                    restoreAuthRequest = null;
                }
            });
        restoreAuthRequest = { authRevision, promise: request };
    }

    return restoreAuthRequest.promise;
};

export const AuthProvider = memo(({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authReady, setAuthReady] = useState(false);
    const [authRestoreError, setAuthRestoreError] = useState(null);
    const userRef = useRef(null);
    const authRevisionRef = useRef(0);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const restoreAuth = useCallback(async ({ silent = false } = {}) => {
        const authRevision = authRevisionRef.current;
        if (!silent) setLoading(true);
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeout = window.setTimeout(() => {
            controller?.abort();
        }, AUTH_RESTORE_TIMEOUT_MS);

        try {
            const { data } = await fetchCurrentUser(controller?.signal, authRevision);
            if (authRevisionRef.current !== authRevision) return userRef.current;
            resetAuthEventGuard();
            setAuthRestoreError(null);
            const safeUser = sanitizeUser(data);
            setUser(safeUser);
            return safeUser;
        } catch (error) {
            if (authRevisionRef.current !== authRevision) return userRef.current;
            if (error.response?.status === 401) {
                clearLegacyAuthState();
                setAuthRestoreError(null);
                setUser(null);
                return null;
            }

            setAuthRestoreError(error);
            return userRef.current;
        } finally {
            window.clearTimeout(timeout);
            if (authRevisionRef.current !== authRevision) return;
            setAuthReady(true);
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        restoreAuth().finally(() => {
            if (!mounted) return;
        });

        const handleLogout = () => {
            authRevisionRef.current += 1;
            void clearAllCreateIncidentDrafts();
            clearLegacyAuthState();
            setAuthRestoreError(null);
            setUser(null);
            setAuthReady(true);
            setLoading(false);
        };

        window.addEventListener('auth:logout', handleLogout);

        return () => {
            mounted = false;
            window.removeEventListener('auth:logout', handleLogout);
        };
    }, [restoreAuth]);

    const login = useCallback((userData) => {
        authRevisionRef.current += 1;
        resetAuthEventGuard();
        setAuthRestoreError(null);
        setUser(sanitizeUser(userData));
        setAuthReady(true);
    }, []);

    const logout = useCallback(async () => {
        // Invalidate an earlier /me request before awaiting network cleanup so
        // it cannot restore a previous workspace while sign-out is in flight.
        authRevisionRef.current += 1;
        try {
            await apiClient.post('/api/auth/logout', {}, { __skipAuthLogout: true });
        } catch {
            // Session may already be expired; local state still needs clearing.
        }
        await clearAllCreateIncidentDrafts();
        clearLegacyAuthState();
        setAuthRestoreError(null);
        setUser(null);
        setAuthReady(true);
        setLoading(false);
    }, []);

    const value = useMemo(
        () => ({ user, login, logout, loading, authReady, authRestoreError, restoreAuth }),
        [authReady, authRestoreError, loading, login, logout, restoreAuth, user]
    );

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
                </div>
            ) : children}
        </AuthContext.Provider>
    );
});

export const useAuth = () => useContext(AuthContext);
