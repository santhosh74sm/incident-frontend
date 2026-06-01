import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import apiClient, { clearLegacyAuthState, resetAuthEventGuard } from '../config/apiClient';

const AuthContext = createContext({
    user: null,
    loading: true,
    authReady: false,
    login: () => {},
    logout: async () => {},
    restoreAuth: async () => {},
});

export const AuthProvider = memo(({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authReady, setAuthReady] = useState(false);

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
            setUser(data || null);
            return data || null;
        } catch (error) {
            if (error.response?.status === 401) {
                clearLegacyAuthState();
            }
            setUser(null);
            return null;
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
        setUser(userData);
        setAuthReady(true);
    }, []);

    const logout = useCallback(async () => {
        try {
            await apiClient.post('/api/auth/logout', {}, { __skipAuthLogout: true });
        } catch {
            // Session may already be expired; local state still needs clearing.
        }
        clearLegacyAuthState();
        setUser(null);
        setAuthReady(true);
        setLoading(false);
    }, []);

    const value = useMemo(
        () => ({ user, login, logout, loading, authReady, restoreAuth }),
        [authReady, loading, login, logout, restoreAuth, user]
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
