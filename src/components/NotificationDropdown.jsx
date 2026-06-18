import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    Bell,
    CheckCircle2,
    Clock3,
    FileText,
    Hand,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../utils/roles';
import { getRecordId, isValidMongoObjectId } from '../utils/ids';
import { formatActivityRecordLabel } from '../utils/analytics';

const DISPLAYED_NOTIFICATION_LIMIT = 12;

// ─── Pure helpers (no hooks, no side-effects) ─────────────────────────────────

const formatActionName = (actionName = '') => {
    const rawValue = String(actionName || '').trim();
    if (!rawValue) return 'System Activity';
    if (/^letter_generated:/i.test(rawValue)) return 'Letter Issued';
    return rawValue
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatRelativeTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (Number.isNaN(diffInSeconds) || diffInSeconds < 0 || diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} min${diffInMinutes === 1 ? '' : 's'} ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
};

const getNotificationPresentation = (notification) => {
    const normalizedAction = String(notification?.actionName || '').toLowerCase();
    const entityType       = String(notification?.entityType || '').toLowerCase();

    if (normalizedAction.includes('delete') || normalizedAction.includes('remove')) {
        return { icon: Trash2,      toneClassName: 'border-rose-200 bg-rose-50 text-rose-700' };
    }
    if (normalizedAction.includes('manual') || normalizedAction.includes('custom timing')) {
        return { icon: Hand,        toneClassName: 'border-amber-200 bg-amber-50 text-amber-700' };
    }
    if (normalizedAction.includes('upload') || entityType === 'bulk upload') {
        return { icon: Upload,      toneClassName: 'border-cyan-200 bg-cyan-50 text-cyan-700' };
    }
    if (entityType === 'letter' || normalizedAction.includes('letter')) {
        return { icon: FileText,    toneClassName: 'border-indigo-200 bg-indigo-50 text-indigo-700' };
    }
    if (
        normalizedAction.includes('assign') ||
        normalizedAction.includes('close') ||
        normalizedAction.includes('progress') ||
        normalizedAction.includes('status')
    ) {
        return { icon: Clock3,      toneClassName: 'border-blue-200 bg-blue-50 text-blue-700' };
    }
    if (entityType === 'incident') {
        return { icon: AlertCircle, toneClassName: 'border-blue-200 bg-blue-50 text-blue-700' };
    }
    return     { icon: ShieldCheck, toneClassName: 'border-slate-200 bg-slate-100 text-slate-700' };
};

const getTargetDetails = (notification) => {
    const metadata       = notification?.metadata || {};
    const studentDetails = notification?.studentDetails || metadata?.studentDetails || null;

    const studentName =
        studentDetails?.studentsInvolved?.[0] ||
        metadata?.studentName ||
        (Array.isArray(metadata?.studentsInvolved) ? metadata.studentsInvolved[0] : null) ||
        null;

    const cls          = studentDetails?.class   || metadata?.class   || null;
    const sec          = studentDetails?.section || metadata?.section || null;
    const classSection = cls ? `Class ${cls}${sec ? ` – ${sec}` : ''}` : null;

    return {
        targetLabel:
            notification?.targetLabel ||
            notification?.incident?.title ||
            metadata?.targetLabel ||
            metadata?.title ||
            notification?.entityType ||
            'System',
        admissionNumber:
            notification?.targetAdmissionNumber ||
            studentDetails?.admissionNo ||
            metadata?.admissionNo ||
            metadata?.['Admission Number'] ||
            notification?.incident?.admissionNo ||
            null,
        studentName,
        classSection,
        status: notification?.incident?.status || metadata?.status || null,
        category: notification?.incident?.category || metadata?.category || metadata?.incidentCategory || null,
    };
};

const resolveNotificationPath = (notification, role) => {
    const metadata = notification?.metadata || {};
    if (notification?.routePath === '/logs' && role !== 'Super Admin') {
        return '/dashboard';
    }

    if (
        notification?.routePath &&
        !/^\/incidents\/[^/]+$/.test(notification.routePath)
    ) {
        return notification.routePath;
    }
    if (
        notification?.routePath &&
        isValidMongoObjectId(notification.routePath.split('/').pop())
    ) {
        return notification.routePath;
    }
    const incidentId = getRecordId(notification?.incident);
    if (isValidMongoObjectId(incidentId)) {
        return `/incidents/${incidentId}`;
    }
    if (notification?.entityType === 'Incident' && isValidMongoObjectId(notification?.entityId)) {
        return `/incidents/${notification.entityId}`;
    }
    if (notification?.entityType === 'Letter') {
        const letterIncidentId = metadata?.incidentId || metadata?.incident || null;
        return isValidMongoObjectId(letterIncidentId)
            ? `/incidents/${letterIncidentId}`
            : isAdminRole(role) ? '/issued-letters' : '/dashboard';
    }
    if (notification?.entityType === 'Template') return '/letter-templates';
    if (notification?.entityType === 'Student') {
        const admissionNumber =
            notification?.targetAdmissionNumber ||
            metadata?.admissionNo ||
            metadata?.['Admission Number'] ||
            null;
        return admissionNumber ? `/student-analytics/${admissionNumber}` : '/user-management';
    }
    if (notification?.entityType === 'Bulk Upload') return '/upload-incidents';
    return role === 'Super Admin' ? '/logs' : '/dashboard';
};

// ─── Hook: detect mobile breakpoint (< 768 px) ───────────────────────────────

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    );

    useEffect(() => {
        const mq   = window.matchMedia('(max-width: 767px)');
        const sync = (e) => setIsMobile(e.matches);
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', sync);
            return () => mq.removeEventListener('change', sync);
        }
        mq.addListener(sync);
        return () => mq.removeListener(sync);
    }, []);

    return isMobile;
};

// ─── NotificationSection ──────────────────────────────────────────────────────

const NotificationSection = ({ title, count, items, onItemClick }) => {
    if (!items?.length) return null;

    const chipClassName =
        'inline-flex min-h-[24px] max-w-full min-w-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5';

    return (
        <section aria-label={`${title} notifications`}>
            {/* Section header */}
            <div className="border-y border-slate-100 bg-white/95 px-3 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:tracking-[0.22em]">
                        {title}
                    </p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {count}
                    </span>
                </div>
            </div>

            <ul className="space-y-3 p-2 dark:bg-slate-950/20 sm:p-3">
                {items.map((notification, index) => {
                    const presentation = getNotificationPresentation(notification);
                    const Icon         = presentation.icon;
                    const { targetLabel, admissionNumber, studentName, classSection, status, category } =
                        getTargetDetails(notification);
                    const isUnread = notification?.read !== true;
                    const notificationKey =
                        getRecordId(notification) ||
                        `${notification?.entityType || 'notification'}-${
                            notification?.entityId || notification?.createdAt || index
                        }-${index}`;

                    return (
                        <li
                            key={notificationKey}
                            className={`overflow-hidden rounded-2xl border transition-colors duration-200 ${
                                isUnread
                                    ? 'border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-950/20'
                                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => onItemClick(notification)}
                                aria-label={`${formatActionName(notification?.actionName)}${studentName ? ` — ${studentName}` : ''}${isUnread ? ' (unread)' : ''}`}
                                className="relative z-[2] flex w-full min-w-0 touch-manipulation items-start gap-3.5 px-3 py-3.5 text-left transition-colors duration-200 hover:bg-slate-50/90 active:bg-slate-100/90 dark:hover:bg-slate-800/80 dark:active:bg-slate-800 sm:px-4 sm:py-4"
                            >
                                {/* Icon badge */}
                                <span
                                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${presentation.toneClassName}`}
                                    aria-hidden
                                >
                                    <Icon size={16} />
                                </span>

                                {/* Text content */}
                                <div className="min-w-0 flex-1 overflow-hidden">
                                    <div className="flex min-w-0 items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">
                                                {formatActionName(notification?.actionName)}
                                            </p>
                                            <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                                {formatActivityRecordLabel(notification.entityType || notification.type)}
                                            </p>
                                        </div>
                                        {isUnread ? (
                                            <span
                                                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                                                aria-hidden
                                            />
                                        ) : (
                                            <CheckCircle2
                                                size={15}
                                                className="mt-0.5 shrink-0 text-slate-300 dark:text-slate-600"
                                                aria-hidden
                                            />
                                        )}
                                    </div>

                                    <div className="mt-2 grid min-w-0 gap-2 text-sm">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                                Student
                                            </p>
                                            <p className="mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-200" title={studentName || 'Not specified'}>
                                                {studentName || 'Not specified'}
                                            </p>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                                Incident
                                            </p>
                                            <p className="mt-0.5 truncate font-medium text-slate-700 dark:text-slate-300" title={targetLabel || 'System'}>
                                                {targetLabel || 'System'}
                                            </p>
                                        </div>
                                    </div>

                                    {notification?.message ? (
                                        <p className="mt-2 line-clamp-3 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
                                            {notification.message}
                                        </p>
                                    ) : null}

                                    {/* Meta chips */}
                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                                        <span className={`${chipClassName} border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400`}>
                                            <span className="truncate">{formatRelativeTime(notification?.createdAt)}</span>
                                        </span>

                                        {admissionNumber ? (
                                            <span className={`${chipClassName} border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300`}>
                                                <span className="truncate">AdNo: {admissionNumber}</span>
                                            </span>
                                        ) : null}

                                        {classSection ? (
                                            <span className={`${chipClassName} border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`}>
                                                <span className="truncate">{classSection}</span>
                                            </span>
                                        ) : null}

                                        {status ? (
                                            <span className={`${chipClassName} border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300`}>
                                                <span className="truncate">{status}</span>
                                            </span>
                                        ) : null}

                                        {category ? (
                                            <span className={`${chipClassName} border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300`}>
                                                <span className="truncate">{category}</span>
                                            </span>
                                        ) : null}
                                    </div>

                                    <p className="mt-2 truncate border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500" title={notification?.performedByName || 'System'}>
                                        By {notification?.performedByName || 'System'}
                                    </p>
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

// ─── NotificationDropdown ─────────────────────────────────────────────────────

const NotificationDropdown = ({ onClose }) => {
    const navigate  = useNavigate();
    const { user }  = useAuth();
    const isMobile  = useIsMobile();

    const {
        notifications,
        unreadCount,
        loading,
        refreshNotifications,
        markAllAsRead,
        markNotificationAsRead,
    } = useNotifications();

    // Close on Escape key
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Prevent body scroll while mobile sheet is open
    useEffect(() => {
        if (!isMobile) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isMobile]);

    const visibleNotifications = useMemo(
        () => notifications.slice(0, DISPLAYED_NOTIFICATION_LIMIT),
        [notifications]
    );

    const unreadNotifications = useMemo(
        () => visibleNotifications.filter((n) => n?.read !== true),
        [visibleNotifications]
    );
    const readNotifications = useMemo(
        () => visibleNotifications.filter((n) => n?.read === true),
        [visibleNotifications]
    );

    const handleNotificationClick = async (notification) => {
        try {
            if (notification?.read !== true) {
                await markNotificationAsRead(notification);
            }
        } catch {
            // Keep navigation responsive even if the read receipt cannot be saved.
        }
        onClose?.();
        navigate(resolveNotificationPath(notification, user?.role));
    };

    // ── Panel header ──────────────────────────────────────────────────────────
    const header = (
        <div className="shrink-0 border-b border-slate-100 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_70%)] px-3 py-4 dark:border-slate-800 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Title */}
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            Notifications
                        </h3>
                        {unreadCount > 0 ? (
                            <span
                                aria-label={`${unreadCount} unread`}
                                className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                            >
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {unreadCount > 0
                            ? `You have ${unreadCount} unread item${unreadCount === 1 ? '' : 's'}.`
                            : 'Latest notifications are shown below.'}
                    </p>
                </div>

                {/* Action buttons */}
                <div className="grid w-full shrink-0 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                    <button
                        type="button"
                        onClick={() => refreshNotifications()}
                        className="inline-flex h-11 min-h-[44px] min-w-[44px] w-11 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        aria-label="Refresh notifications"
                        title="Refresh"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden />
                    </button>

                    <button
                        type="button"
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0}
                        aria-disabled={unreadCount === 0}
                        className="min-h-[44px] min-w-0 touch-manipulation rounded-xl border border-blue-200 bg-blue-50 px-2 py-2 text-xs font-semibold text-blue-700 transition-colors duration-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60 sm:px-4"
                    >
                        Mark all read
                    </button>

                    {/* Close button — visible on mobile only */}
                    {isMobile ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-11 min-h-[44px] min-w-[44px] w-11 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            aria-label="Close notifications"
                        >
                            <X size={16} aria-hidden />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );

    // ── Panel body ────────────────────────────────────────────────────────────
    const body = (
        <div
            className={`overflow-y-auto overscroll-contain ${
                isMobile ? 'min-h-0 flex-1' : 'max-h-[min(70vh,42rem)]'
            } overflow-x-hidden`}
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
        >
            {loading && visibleNotifications.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin text-blue-600" aria-hidden />
                    Loading notifications…
                </div>
            ) : visibleNotifications.length === 0 ? (
                <div className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                        <Bell size={20} aria-hidden />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        No notifications yet
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        When incidents are assigned, updated, or closed, you'll see them here.
                    </p>
                </div>
            ) : (
                <>
                    {/* "New" = unread */}
                    <NotificationSection
                        title="New"
                        count={unreadNotifications.length}
                        items={unreadNotifications}
                        onItemClick={handleNotificationClick}
                    />
                    {/* "Earlier" = already read */}
                    <NotificationSection
                        title="Earlier"
                        count={readNotifications.length}
                        items={readNotifications}
                        onItemClick={handleNotificationClick}
                    />
                </>
            )}
        </div>
    );

    // ── Mobile: full-screen bottom sheet + backdrop ───────────────────────────
    if (isMobile) {
        return createPortal(
            <>
                {/* Backdrop */}
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-[2px]"
                    onClick={onClose}
                />

                {/* Sheet panel */}
                <div
                    data-notification-panel
                    role="dialog"
                    aria-modal="true"
                    aria-label="Notifications"
                    className="fixed inset-x-0 bottom-0 z-[90] flex max-w-full flex-col overflow-hidden rounded-t-[24px] border-t border-slate-200/80 bg-white shadow-[0_-24px_60px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900 sm:rounded-t-[28px]"
                    style={{
                        top: '56px',
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    }}
                >
                    {/* Drag handle */}
                    <div className="flex shrink-0 justify-center pt-3 pb-1">
                        <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
                    </div>

                    {header}
                    {body}
                </div>
            </>,
            document.body
        );
    }

    // ── Desktop / Tablet: anchored dropdown ───────────────────────────────────
    return (
        <div
            data-notification-panel
            role="complementary"
            aria-label="Notifications"
            className="absolute right-0 z-[75] mt-3 flex w-[min(42rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/95 shadow-[0_30px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:rounded-[28px]"
        >
            {header}
            {body}

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                    {visibleNotifications.length === 0
                        ? 'No activity to display'
                        : `${visibleNotifications.length} latest notification${visibleNotifications.length !== 1 ? 's' : ''} loaded`}
                </p>
            </div>
        </div>
    );
};

export default NotificationDropdown;
