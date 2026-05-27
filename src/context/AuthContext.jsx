import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import apiClient, { clearLegacyAuthState } from '../config/apiClient';

const AuthContext = createContext({
    user: null,
    loading: true,
    login: () => {},
    logout: async () => {},
});

export const AuthProvider = memo(({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        apiClient
            .get('/api/auth/me')
            .then(({ data }) => {
                if (mounted) setUser(data);
            })
            .catch((error) => {
                if (error.response?.status === 401) {
                    clearLegacyAuthState();
                }
                if (mounted) setUser(null);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        const handleLogout = () => {
            clearLegacyAuthState();
            setUser(null);
        };

        window.addEventListener('auth:logout', handleLogout);

        return () => {
            mounted = false;
            window.removeEventListener('auth:logout', handleLogout);
        };
    }, []);

    const login = useCallback((userData) => {
        setUser(userData);
    }, []);

    const logout = useCallback(async () => {
        try {
            await apiClient.post('/api/auth/logout');
        } catch {
            // Session may already be expired; local state still needs clearing.
        }
        clearLegacyAuthState();
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, login, logout, loading }),
        [loading, login, logout, user]
    );

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
});

export const useAuth = () => useContext(AuthContext);
