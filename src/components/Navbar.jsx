import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bell,
    Check,
    Command,
    Building2,
    ChevronDown,
    Edit3,
    ListFilter,
    LogOut,
    Loader2,
    Settings,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/apiClient';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useConfirm } from './ConfirmProvider';
import { useToast } from './ToastProvider';
import NotificationDropdown from './NotificationDropdown';
import { isAdminRole, isSuperAdminRole, normalizeRole } from '../utils/roles';

const isMacPlatform = () => {
    if (typeof navigator === 'undefined') return false;
    const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
    return /Mac|iPhone|iPad|iPod/i.test(platform);
};

const Navbar = ({ isSidebarCollapsed = false }) => {
    const { user, logout, restoreAuth } = useAuth();
    const [isMac] = useState(isMacPlatform);
    const { unreadCount, enabled: notificationsEnabled } = useNotifications();
    const confirm = useConfirm();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showNotificationPanel, setShowNotificationPanel] = useState(false);
    const [showProfileEdit, setShowProfileEdit] = useState(false);
    const [profileForm, setProfileForm] = useState({ name: '', email: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const notificationRef = useRef(null);
    const profileRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const target = event.target;
            const inNotificationBell    = notificationRef.current?.contains(target);
            const inNotificationTrigger = typeof target.closest === 'function' && target.closest('[data-notification-trigger]');
            const inNotificationPortal  = typeof target.closest === 'function' && target.closest('[data-notification-panel]');
            const isBackdrop = target?.getAttribute?.('aria-hidden') === 'true' &&
                target?.classList?.contains('fixed');

            if (!isBackdrop && (inNotificationTrigger || inNotificationBell || inNotificationPortal)) {
                return;
            }
            setShowNotificationPanel(false);

            if (profileRef.current && !profileRef.current.contains(target)) {
                setShowDropdown(false);
                setShowProfileEdit(false);
            }
        };

        document.addEventListener('pointerdown', handleClickOutside);
        return () => {
            document.removeEventListener('pointerdown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!notificationsEnabled) {
            setShowNotificationPanel(false);
        }
    }, [notificationsEnabled]);

    useEffect(() => {
        const handleOpenNotifications = () => {
            if (!notificationsEnabled) return;
            setShowNotificationPanel((current) => !current);
            setShowDropdown(false);
        };

        window.addEventListener('open-notifications-panel', handleOpenNotifications);
        return () => window.removeEventListener('open-notifications-panel', handleOpenNotifications);
    }, [notificationsEnabled]);

    const openCommandPalette = useCallback(() => {
        window.dispatchEvent(new CustomEvent('open-command-palette'));
        setShowNotificationPanel(false);
        setShowDropdown(false);
    }, []);

    const toggleNotificationPanel = useCallback(() => {
        if (!notificationsEnabled) return;
        setShowNotificationPanel((current) => !current);
        setShowDropdown(false);
    }, [notificationsEnabled]);

    const toggleProfileDropdown = useCallback(() => {
        setShowDropdown((current) => !current);
        setShowNotificationPanel(false);
    }, []);

    useEffect(() => {
        setProfileForm({
            name: user?.name || '',
            email: user?.email || '',
        });
    }, [user?.email, user?.name]);

    const currentUserId = user?._id || user?.id;

    const handleProfileSubmit = useCallback(async (event) => {
        event.preventDefault();
        if (!currentUserId) return;

        setSavingProfile(true);

        try {
            await apiClient.put(`/api/auth/users/${currentUserId}`, {
                name: profileForm.name.trim(),
                email: profileForm.email.trim(),
            });
            await restoreAuth({ silent: true });
            addToast('Profile updated successfully.', 'success');
            setShowProfileEdit(false);
        } catch (error) {
            addToast(error.response?.data?.message || 'Unable to update profile.', 'error');
        } finally {
            setSavingProfile(false);
        }
    }, [addToast, currentUserId, profileForm.email, profileForm.name, restoreAuth]);

    const handleSignOut = useCallback(async () => {
        const confirmed = await confirm({
            tone: 'warning',
            title: 'Are you sure you want to sign out?',
            description: 'Any unsaved work or drafts from this session will be cleared after signing out.',
            confirmLabel: 'Sign Out',
            cancelLabel: 'Cancel',
        });

        if (!confirmed) return;

        await logout();
        setShowDropdown(false);
        navigate('/login', { replace: true });
    }, [confirm, logout, navigate]);

    const profileMenuItems = useMemo(() => {
        if (!isAdminRole(user?.role)) {
            return [];
        }
        return [
            ...(isSuperAdminRole(user?.role)
                ? [{ label: 'Activity History', icon: ListFilter, action: () => navigate('/logs') }]
                : []),
            { label: 'Staff & Students', icon: Settings, action: () => navigate('/user-management') },
        ];
    }, [navigate, user?.role]);
    const normalizedRole = normalizeRole(user?.role);

    const hasUnread = unreadCount > 0;
    return (
        <nav
            className={`fixed right-0 top-0 z-[60] h-[76px] border-b border-slate-200/75 bg-white/95 px-3 py-3 backdrop-blur-xl transition-all duration-300 sm:px-4 lg:px-7 ${
                isSidebarCollapsed ? 'left-0 lg:left-[68px]' : 'left-0 lg:left-[242px]'
            }`}
        >
            <div className="pl-14 sm:pl-16 lg:pl-0">
                <div className="h-[52px]">
                    <div className="flex h-full min-w-0 items-center justify-between gap-3">
                        <div
                            className="hidden h-9 items-center gap-1.5 bg-transparent px-1 text-slate-700 cursor-default select-none lg:flex"
                        >
                            <Building2 size={16} className="shrink-0 text-slate-500 " />
                            <span className="text-sm font-medium">{normalizedRole || 'User'} Workspace</span>
                        </div>

                        <button
                            type="button"
                            onClick={openCommandPalette}
                            className="group inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm transition-all duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:hidden"
                            aria-label="Open search"
                            title="Search"
                        >
                            <Command size={18} />
                        </button>

                        <button
                            type="button"
                            onClick={openCommandPalette}
                            className="group hidden h-11 min-w-0 flex-1 max-w-[380px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex"
                            aria-label="Open search"
                            title="Search"
                        >
                            <Command size={17} className="shrink-0 text-slate-500" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">Search incidents...</p>
                            </div>
                            <div className="hidden shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 md:flex">
                                {isMac ? (
                                    <kbd className="text-[11px] font-semibold text-slate-600 ">⌘</kbd>
                                ) : (
                                    <kbd className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 ">Ctrl</kbd>
                                )}
                                {!isMac && <span className="text-slate-300 ">+</span>}
                                <kbd className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 ">K</kbd>
                            </div>
                        </button>

                        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
                            {isAdminRole(user?.role) ? (
                                <button
                                    type="button"
                                    title="Settings"
                                    onClick={() => navigate('/user-management')}
                                    className="inline-flex h-11 min-h-[44px] min-w-[44px] w-11 items-center justify-center rounded-lg text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 "
                                    aria-label="Open settings"
                                >
                                    <Settings size={18} />
                                </button>
                            ) : null}

                            <div className="relative" ref={notificationRef}>
                                <button
                                    type="button"
                                    title="Notifications"
                                    onClick={toggleNotificationPanel}
                                    disabled={!notificationsEnabled}
                                    data-notification-trigger
                                    className={`relative inline-flex h-11 min-h-[44px] min-w-[44px] w-11 items-center justify-center rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                        showNotificationPanel || hasUnread
                                            ? 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-100/70'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 '
                                    } ${showNotificationPanel || hasUnread ? '' : ''} ${!notificationsEnabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                    aria-label={hasUnread ? `${unreadCount} unread notifications` : 'Notifications'}
                                    aria-disabled={!notificationsEnabled}
                                    aria-expanded={showNotificationPanel}
                                    aria-haspopup="dialog"
                                >
                                    <Bell size={18} />
                                    {hasUnread ? (
                                        <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-rose-500/30">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </span>
                                    ) : null}
                                </button>

                                {showNotificationPanel ? (
                                    <NotificationDropdown onClose={() => setShowNotificationPanel(false)} />
                                ) : null}
                            </div>

                            <div className="relative" ref={profileRef}>
                                <button
                                    type="button"
                                    title="Profile"
                                    onClick={toggleProfileDropdown}
                                    className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:gap-3 sm:px-3 ${
                                        showDropdown
                                            ? 'bg-blue-50 shadow-sm shadow-blue-100/70 '
                                            : 'hover:bg-slate-100 '
                                    }`}
                                    aria-expanded={showDropdown}
                                    aria-haspopup="menu"
                                >
                                    <div className="hidden text-right sm:block">
                                        <p className="text-sm font-semibold leading-tight text-slate-900 ">
                                            {user?.name}
                                        </p>
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                                            {normalizedRole}
                                        </p>
                                    </div>

                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-500/20">
                                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                    <ChevronDown size={15} className="hidden text-slate-500 sm:block" />
                                </button>

                                {showDropdown ? (
                                    <div role="menu" aria-label="Account menu" className="absolute right-0 z-[60] mt-3 max-h-[calc(100vh-5rem)] w-[min(19rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_30px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:rounded-[26px]">
                                        <div className="border-b border-slate-100 px-5 py-4 ">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 ">
                                                Account
                                            </p>
                                            <p className="mt-2 text-sm font-semibold text-slate-900 ">{user?.name}</p>
                                            <p className="mt-1 break-words text-xs text-slate-500 ">{user?.email}</p>
                                            <button
                                                type="button"
                                                onClick={() => setShowProfileEdit((current) => !current)}
                                                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 "
                                                aria-expanded={showProfileEdit}
                                            >
                                                {showProfileEdit ? <X size={14} /> : <Edit3 size={14} />}
                                                {showProfileEdit ? 'Cancel Edit' : 'Edit Profile'}
                                            </button>
                                        </div>

                                        {showProfileEdit ? (
                                            <form onSubmit={handleProfileSubmit} className="border-b border-slate-100 px-5 py-4 ">
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 ">
                                                            Name
                                                        </label>
                                                        <input
                                                            required
                                                            type="text"
                                                            value={profileForm.name}
                                                            onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 "
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 ">
                                                            Email
                                                        </label>
                                                        <input
                                                            required
                                                            type="email"
                                                            value={profileForm.email}
                                                            onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 "
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 ">
                                                            Role
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={normalizedRole || 'User'}
                                                            readOnly
                                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 "
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowProfileEdit(false)}
                                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 "
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={savingProfile}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                                                    >
                                                        {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </form>
                                        ) : null}

                                        <div className="px-3 py-3">
                                            {profileMenuItems.map((item) => {
                                                const Icon = item.icon;
                                                return (
                                                    <button
                                                        key={item.label}
                                                        type="button"
                                                        onClick={() => {
                                                            item.action();
                                                            setShowDropdown(false);
                                                        }}
                                                        role="menuitem"
                                                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 "
                                                    >
                                                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ">
                                                            <Icon size={16} />
                                                        </span>
                                                        {item.label}
                                                    </button>
                                                );
                                            })}

                                            <button
                                                type="button"
                                                onClick={handleSignOut}
                                                role="menuitem"
                                                className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-rose-600 transition-all duration-200 hover:bg-rose-50"
                                            >
                                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                                                    <LogOut size={16} />
                                                </span>
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
