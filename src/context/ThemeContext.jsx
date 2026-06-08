import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'st-incident-system:theme';
const ThemeContext = createContext(null);

const getStoredTheme = () => {
    if (typeof window === 'undefined') return 'system';
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    return ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'system';
};

const prefersDarkMode = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyTheme = (mode) => {
    if (typeof document === 'undefined') return;

    const useDarkMode = mode === 'dark' || (mode === 'system' && prefersDarkMode());
    document.documentElement.classList.toggle('dark', useDarkMode);
    document.body?.classList?.toggle('dark', useDarkMode);
    document.documentElement.style.colorScheme = useDarkMode ? 'dark' : 'light';
    if (document.body) {
        document.body.style.colorScheme = useDarkMode ? 'dark' : 'light';
    }
};

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeModeState] = useState(getStoredTheme);

    const setThemeMode = useCallback((mode) => {
        const nextMode = ['light', 'dark', 'system'].includes(mode) ? mode : 'system';
        setThemeModeState(nextMode);
        window.localStorage.setItem(STORAGE_KEY, nextMode);
        applyTheme(nextMode);
    }, []);

    useEffect(() => {
        applyTheme(themeMode);

        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const syncSystemTheme = () => {
            if (themeMode === 'system') {
                applyTheme('system');
            }
        };

        mediaQuery.addEventListener('change', syncSystemTheme);
        return () => mediaQuery.removeEventListener('change', syncSystemTheme);
    }, [themeMode]);

    const value = useMemo(
        () => ({
            themeMode,
            setThemeMode,
        }),
        [setThemeMode, themeMode]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used inside ThemeProvider');
    }
    return context;
};
