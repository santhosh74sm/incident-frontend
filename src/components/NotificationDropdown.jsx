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

const formatRecordTypeLabel = (type) => {
    const key = String(type || '').trim().toLowerCase();
    const map = {
        incident    : 'Incident',
        letter      : 'Letter',
        template    : 'Letter file',
        student     : 'Student',
        user        : 'Staff member',
        'bulk upload': 'Bulk upload',
        log         : 'Activity',
    };
    if (!key) return '';
    return map[key] || 'School record';
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
    };
};

const isValidMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const resolveNotificationPath = (notification, role) => {
    const metadata = notification?.metadata || {};

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
    const incidentId = notification?.incident?.id || notification?.incident?._id;
    if (isValidMongoObjectId(incidentId)) {
        return `/incidents/${incidentId}`;
    }
    if (notification?.entityType === 'Incident' && isValidMongoObjectId(notification?.entityId)) {
        return `/incidents/${notification.entityId}`;
    }
    if (notification?.entityType === 'Letter') {
        const incidentId = metadata?.incidentId || metadata?.incident || null;
        return isValidMongoObjectId(incidentId)
            ? `/incidents/${incidentId}`
            : ['Super Admin', 'Admin'].includes(role) ? '/issued-letters' : '/dashboard';
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
    return ['Super Admin', 'Admin'].includes(role) ? '/logs' : '/dashboard';
};

// ─── Hook: detect mobile breakpoint (< 768 px) ───────────────────────────────
// Mobile  → full-screen slide-up sheet
// Tablet+ → anchored dropdown (max-w 400 px)

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

    return (
        <section>
            {/* Sticky section header */}
            <div className="sticky top-0 z-[1] border-y border-slate-100 bg-white/95 px-5 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        {title}
                    </p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {count}
                    </span>
                </div>
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((notification, index) => {
                    const presentation = getNotificationPresentation(notification);
                    const Icon         = presentation.icon;
                    const { targetLabel, admissionNumber, studentName, classSection } =
                        getTargetDetails(notification);
                    const isUnread = notification?.read !== true;
                    const notificationKey =
                        notification?._id ||
                        `${notification?.entityType || 'notification'}-${
                            notification?.entityId || notification?.createdAt || index
                        }-${index}`;

                    return (
                        <li
                            key={notificationKey}
                            className={`transition-colors duration-200 ${
                                isUnread ? 'bg-blue-50/45 dark:bg-blue-950/20' : 'bg-white/80 dark:bg-slate-900/80'
                            }`}
                        >
                            {/* Touch target: min 48 px tall, full width */}
                            <button
                                type="button"
                                onClick={() => onItemClick(notification)}
                                className="relative z-[2] flex min-h-[56px] w-full touch-manipulation items-start gap-3 px-5 py-4 text-left transition-colors duration-200 hover:bg-slate-50/90 active:bg-slate-100/90 dark:hover:bg-slate-800/80 dark:active:bg-slate-800"
                            >
                                {/* Icon badge */}
                                <span
                                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${presentation.toneClassName}`}
                                >
                                    <Icon size={16} aria-hidden />
                                </span>

                                {/* Text content — flex-1 + min-w-0 ensures wrapping */}
                                <div className="min-w-0 flex-1 overflow-hidden">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-slate-900">
                                            {formatActionName(notification?.actionName)}
                                        </p>
                                        {isUnread ? (
                                            <span
                                                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                                                aria-label="Unread"
                                            />
                                        ) : (
                                            <CheckCircle2
                                                size={15}
                                                className="mt-0.5 shrink-0 text-slate-300"
                                                aria-hidden
                                            />
                                        )}
                                    </div>

                                    {studentName ? (
                                        <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                                            {studentName}
                                        </p>
                                    ) : null}

                                    <p className="mt-0.5 break-words text-sm text-slate-600">
                                        {notification?.performedByName || 'System'}
                                        {targetLabel ? ` | ${targetLabel}` : ''}
                                    </p>

                                    {notification?.message ? (
                                        <p className="mt-1 line-clamp-3 break-words text-xs leading-5 text-slate-500">
                                            {notification.message}
                                        </p>
                                    ) : null}

                                    {/* Meta chips */}
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                                            {formatRelativeTime(notification?.createdAt)}
                                        </span>

                                        {admissionNumber ? (
                                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                                AdNo: {admissionNumber}
                                            </span>
                                        ) : null}

                                        {classSection ? (
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                {classSection}
                                            </span>
                                        ) : null}

                                        {notification?.entityType ? (
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                                {formatRecordTypeLabel(notification.entityType)}
                                            </span>
                                        ) : null}
                                    </div>
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
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
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

    const unreadNotifications = useMemo(
        () => notifications.filter((n) => n?.read !== true),
        [notifications]
    );
    const readNotifications = useMemo(
        () => notifications.filter((n) => n?.read === true),
        [notifications]
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
        <div className="shrink-0 border-b border-slate-100 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_70%)] px-4 py-4 dark:border-slate-800 sm:px-5">
            <div className="flex items-start justify-between gap-3">
                {/* Title + subtitle */}
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                        {unreadCount > 0 ? (
                            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Unread alerts stay pinned above recent activity.
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex shrink-0 items-center gap-2">
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
                        className="min-h-[44px] touch-manipulation rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition-colors duration-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                isMobile
                    ? 'min-h-0 flex-1'          // fills remaining height in flex column
                    : 'max-h-[60vh]'             // capped at 60 vh on desktop/tablet
            }`}
            // Custom thin scrollbar via inline style — no extra CSS file needed
            style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent',
            }}
        >
            {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin text-blue-600" aria-hidden />
                    Loading notifications…
                </div>
            ) : notifications.length === 0 ? (
                <div className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                        <Bell size={18} aria-hidden />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-700">No notifications yet</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Incident assignments, progress updates, closures, and registrations will appear here.
                    </p>
                </div>
            ) : (
                <>
                    <NotificationSection
                        title="Unread"
                        count={unreadNotifications.length}
                        items={unreadNotifications}
                        onItemClick={handleNotificationClick}
                    />
                    <NotificationSection
                        title="Read"
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
                {/* Backdrop — tap to close */}
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
                    className="fixed inset-x-0 bottom-0 z-[90] flex flex-col overflow-hidden rounded-t-[28px] border-t border-slate-200/80 bg-white shadow-[0_-24px_60px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900"
                    style={{
                        // Sits above MobileBottomNav (z-40) and Navbar (z-60)
                        // Top edge: just below the Navbar (56 px = h-14)
                        top: '56px',
                        // Bottom edge: above the MobileBottomNav + safe area
                        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    }}
                >
                    {/* Drag handle visual cue */}
                    <div className="flex shrink-0 justify-center pt-3 pb-1">
                        <div className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
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
            className="absolute right-0 z-[75] mt-3 flex w-[min(400px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_30px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95"
        >
            {header}
            {body}
            {/* Footer spacer */}
            <div className="shrink-0 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                <p className="text-center text-[11px] text-slate-400">
                    Showing latest {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                </p>
            </div>
        </div>
    );
};

export default NotificationDropdown;
