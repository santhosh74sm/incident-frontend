/**
 * NotificationContext.jsx
 * Real-time notification state via Server-Sent Events (SSE).
 *
 * Strategy:
 * - Primary: SSE stream at /api/notifications/stream — instant push, no polling.
 * - Fallback: REST GET /api/notifications if SSE fails or browser unsupported.
 * - SSE auto-reconnects with exponential back-off (max 30 s).
 * - On tab refocus / visibility change: re-open SSE if it was closed.
 * - Mark-as-read / mark-all / delete still use REST; SSE push from server
 *   updates the list automatically after each write.
 */

import React, {
    createContext,
    memo,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import apiClient, { API_BASE } from '../config/apiClient';
import { useAuth } from './AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const SSE_URL = `${API_BASE}/api/notifications/stream`;
const RECONNECT_BASE_MS = 2000;   // initial reconnect delay
const RECONNECT_MAX_MS  = 30000;  // cap at 30 s
const HEARTBEAT_TIMEOUT_MS = 35000; // close & reconnect if no heartbeat in 35s (server sends every 15s)

// ─── Context default ──────────────────────────────────────────────────────────

const NotificationContext = createContext({
    notifications: [],
    unreadCount: 0,
    loading: false,
    enabled: false,
    sseConnected: false,
    refreshNotifications: async () => {},
    markAllAsRead: async () => {},
    markNotificationAsRead: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

const NotificationProvider = memo(({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications]   = useState([]);
    const [loading, setLoading]               = useState(false);
    const [sseConnected, setSseConnected]     = useState(false);

    // Refs — survive re-renders without triggering them
    const esRef            = useRef(null);  // EventSource instance
    const reconnectTimer   = useRef(null);
    const heartbeatTimer   = useRef(null);
    const reconnectDelay   = useRef(RECONNECT_BASE_MS);
    const mountedRef       = useRef(true);

    const enabled = useMemo(
        () => Boolean(user?._id && ['Super Admin', 'Admin', 'Teacher', 'super_admin', 'admin', 'teacher'].includes(user?.role)),
        [user?._id, user?.role]
    );

    // ── REST fallback fetch ───────────────────────────────────────────────────

    const fetchViaRest = useCallback(async () => {
        if (!mountedRef.current) return;
        try {
            setLoading(true);
            const { data } = await apiClient.get('/api/notifications');
            if (mountedRef.current) {
                setNotifications(Array.isArray(data) ? data : []);
            }
        } catch {
            // Silently ignore — SSE will recover
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    // ── Heartbeat watchdog ────────────────────────────────────────────────────
    // Resets every time the server sends ANY message (data or comment).
    // If silent for HEARTBEAT_TIMEOUT_MS, close the stale connection — the
    // reconnect logic will open a fresh one.

    const openSSERef = useRef(null);

    const resetHeartbeat = useCallback(() => {
        if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
        heartbeatTimer.current = setTimeout(() => {
            if (!mountedRef.current) return;
            // Connection appears stale — force reconnect
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
            setSseConnected(false);
            
            // Actually force reconnect
            const delay = reconnectDelay.current;
            reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_MS);
            reconnectTimer.current = setTimeout(() => {
                if (mountedRef.current && openSSERef.current) {
                    openSSERef.current();
                }
            }, delay);
            
        }, HEARTBEAT_TIMEOUT_MS);
    }, []);

    // ── Open SSE connection ───────────────────────────────────────────────────

    const openSSE = useCallback(() => {
        if (!mountedRef.current || !enabled) return;
        if (esRef.current) return; // already open

        // EventSource sends cookies automatically — same-origin or with CORS
        const es = new EventSource(SSE_URL, { withCredentials: true });
        esRef.current = es;
        openSSERef.current = openSSE;

        es.addEventListener('open', () => {
            if (!mountedRef.current) return;
            setSseConnected(true);
            reconnectDelay.current = RECONNECT_BASE_MS; // reset back-off
            resetHeartbeat();
        });

        // 'init' event — server sends full list on first connect
        es.addEventListener('init', (e) => {
            if (!mountedRef.current) return;
            resetHeartbeat();
            try {
                const data = JSON.parse(e.data);
                setNotifications(Array.isArray(data) ? data : []);
            } catch { /* ignore parse errors */ }
        });

        // 'notifications' event — server pushes updated list after writes
        es.addEventListener('notifications', (e) => {
            if (!mountedRef.current) return;
            resetHeartbeat();
            try {
                const data = JSON.parse(e.data);
                setNotifications(Array.isArray(data) ? data : []);
            } catch { /* ignore parse errors */ }
        });

        // Generic message fallback
        es.onmessage = (e) => {
            resetHeartbeat();
            if (!mountedRef.current) return;
            try {
                const data = JSON.parse(e.data);
                if (Array.isArray(data)) setNotifications(data);
            } catch { /* ignore */ }
        };

        es.onerror = () => {
            if (!mountedRef.current) return;
            es.close();
            esRef.current = null;
            setSseConnected(false);
            if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);

            // Exponential back-off reconnect
            const delay = reconnectDelay.current;
            reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_MS);

            reconnectTimer.current = setTimeout(() => {
                if (mountedRef.current && enabled) openSSE();
            }, delay);
        };
    }, [enabled, resetHeartbeat]); // openSSE is stable; eslint needs these deps

    // ── Close SSE and timers ──────────────────────────────────────────────────

    const closeSSE = useCallback(() => {
        if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
        if (heartbeatTimer.current) { clearTimeout(heartbeatTimer.current); heartbeatTimer.current = null; }
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        setSseConnected(false);
    }, []);

    // ── Lifecycle: open/close SSE when enabled changes ────────────────────────

    useEffect(() => {
        mountedRef.current = true;

        if (!enabled) {
            closeSSE();
            setNotifications([]);
            setLoading(false);
            return () => { mountedRef.current = false; closeSSE(); };
        }

        // Check browser support
        if (typeof EventSource === 'undefined') {
            // Fallback to REST for old browsers
            fetchViaRest();
            return () => { mountedRef.current = false; };
        }

        openSSE();

        // Reconnect when tab becomes visible again
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && !esRef.current && enabled) {
                openSSE();
            }
        };

        // Reconnect on network recovery
        const handleOnline = () => {
            if (!esRef.current && enabled) openSSE();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            mountedRef.current = false;
            closeSSE();
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };
    }, [enabled, openSSE, closeSSE, fetchViaRest]);

    // ── Public refreshNotifications (REST pull, e.g. after mark-as-read) ──────
    // SSE push makes this rarely needed, but keep it for manual triggers.

    const refreshNotifications = useCallback(
        async ({ silent = false } = {}) => {
            if (!enabled) return;
            if (!silent) setLoading(true);
            await fetchViaRest();
        },
        [enabled, fetchViaRest]
    );

    // ── Mark a single notification as read ────────────────────────────────────

    const markNotificationAsRead = useCallback(
        async (notification) => {
            const notificationId = notification?._id || notification;
            const isAlreadyRead  = notification?.read === true;
            if (!enabled || !notificationId || isAlreadyRead) return;

            // Optimistic update
            setNotifications((prev) =>
                prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
            );

            try {
                await apiClient.put(`/api/notifications/${notificationId}/read`, {});
                // Server will push updated list via SSE automatically
            } catch (error) {
                if (error.response?.status === 404 || error.response?.status === 400) {
                    setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
                    return;
                }
                // Revert optimistic update on unexpected error
                await fetchViaRest();
            }
        },
        [enabled, fetchViaRest]
    );

    // ── Mark all as read ──────────────────────────────────────────────────────

    const markAllAsRead = useCallback(async () => {
        if (!enabled) return;

        // Optimistic update
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

        try {
            await apiClient.put('/api/notifications/read-all', {});
            // Server SSE push will confirm
        } catch {
            await fetchViaRest();
        }
    }, [enabled, fetchViaRest]);

    // ── Derived state ─────────────────────────────────────────────────────────

    const unreadCount = useMemo(
        () => notifications.filter((n) => n?.read !== true).length,
        [notifications]
    );

    const value = useMemo(
        () => ({
            notifications,
            unreadCount,
            loading,
            enabled,
            sseConnected,
            refreshNotifications,
            markAllAsRead,
            markNotificationAsRead,
        }),
        [enabled, loading, markAllAsRead, markNotificationAsRead,
         notifications, refreshNotifications, sseConnected, unreadCount]
    );

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
});

const useNotifications = () => useContext(NotificationContext);

export { NotificationProvider, useNotifications };
