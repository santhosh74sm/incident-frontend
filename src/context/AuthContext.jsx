import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import apiClient, { clearLegacyAuthState, resetAuthEventGuard } from '../config/apiClient';

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

const sanitizeUser = (value) => {
    if (!value || typeof value !== 'object') return value || null;
    const user = { ...value };
    delete user[PRIVATE_TENANT_FIELD];
    return user;
};

export const AuthProvider = memo(({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authReady, setAuthReady] = useState(false);
    const [authRestoreError, setAuthRestoreError] = useState(null);
    const userRef = useRef(null);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const restoreAuth = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);

        try {
            const { data } = await apiClient.get('/api/auth/me', {
                __skipAuthLogout: true,
                headers: {
                    'Cache-Control': 'no-store',
                },
            });
            resetAuthEventGuard();
            setAuthRestoreError(null);
            const safeUser = sanitizeUser(data);
            setUser(safeUser);
            return safeUser;
        } catch (error) {
            if (error.response?.status === 401) {
                clearLegacyAuthState();
                setAuthRestoreError(null);
                setUser(null);
                return null;
            }

            setAuthRestoreError(error);
            return userRef.current;
        } finally {
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
        resetAuthEventGuard();
        setAuthRestoreError(null);
        setUser(sanitizeUser(userData));
        setAuthReady(true);
    }, []);

    const logout = useCallback(async () => {
        try {
            await apiClient.post('/api/auth/logout', {}, { __skipAuthLogout: true });
        } catch {
            // Session may already be expired; local state still needs clearing.
        }
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
