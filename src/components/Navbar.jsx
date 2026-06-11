import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bell,
    Check,
    Command,
    Edit3,
    ListFilter,
    LogOut,
    Loader2,
    Monitor,
    Moon,
    Settings,
    Sun,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/apiClient';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastProvider';
import NotificationDropdown from './NotificationDropdown';

const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

const Navbar = ({ isSidebarCollapsed = false }) => {
    const { user, logout, restoreAuth } = useAuth();
    const { unreadCount, enabled: notificationsEnabled } = useNotifications();
    const { themeMode, setThemeMode } = useTheme();
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

    const profileMenuItems = useMemo(() => {
        if (!['Super Admin', 'Admin'].includes(user?.role)) {
            return [];
        }
        return [
            { label: 'Activity history', icon: ListFilter, action: () => navigate('/logs') },
            { label: 'Staff & students', icon: Settings, action: () => navigate('/user-management') },
        ];
    }, [navigate, user?.role]);

    const hasUnread = unreadCount > 0;
    const iconButtonBase =
        'inline-flex h-11 min-h-[44px] min-w-[44px] w-11 items-center justify-center rounded-xl bg-white/80 text-slate-600 backdrop-blur transition-all duration-200 hover:bg-white hover:text-slate-950 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

    return (
        <nav
            className={`fixed right-0 top-0 z-[60] h-14 bg-white/80 px-3 py-2 backdrop-blur-xl transition-all duration-300 dark:bg-slate-950/80 sm:px-4 lg:px-5 ${
                isSidebarCollapsed ? 'left-0 lg:left-[68px]' : 'left-0 lg:left-[268px]'
            }`}
        >
            <div className="pl-14 sm:pl-16 lg:pl-0">
                <div className="h-10 rounded-2xl bg-white/90 px-2 backdrop-blur-xl dark:bg-slate-900/90 sm:px-3">
                    <div className="flex h-full min-w-0 items-center justify-between gap-2">
                        <div className="hidden min-w-0 lg:block">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.role || 'User'} Workspace</p>
                        </div>

                        <button
                            type="button"
                            onClick={openCommandPalette}
                            className="group inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-white/70 text-slate-900 backdrop-blur transition-all duration-200 hover:bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800 sm:hidden"
                            aria-label="Open search"
                            title="Search"
                        >
                            <Command size={18} />
                        </button>

                        <button
                            type="button"
                            onClick={openCommandPalette}
                            className="group hidden min-w-0 max-w-[200px] shrink-0 items-center gap-2 rounded-xl bg-white/70 px-2.5 py-1.5 text-left backdrop-blur transition-all duration-200 hover:bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900/70 dark:hover:bg-slate-800 sm:flex lg:max-w-[220px]"
                            aria-label="Open search"
                            title="Search"
                        >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-lg shadow-slate-950/15 transition-all duration-200 group-hover:bg-indigo-600">
                                <Command size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">Search</p>
                            </div>
                            <div className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/90 md:flex">
                                <kbd className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">Ctrl</kbd>
                                <span className="text-slate-300 dark:text-slate-600">+</span>
                                <kbd className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">K</kbd>
                            </div>
                        </button>

                        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                            {['Super Admin', 'Admin'].includes(user?.role) ? (
                                <button
                                    type="button"
                                    title="Settings"
                                    onClick={() => navigate('/user-management')}
                                    className={iconButtonBase}
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
                                            ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100/70'
                                            : iconButtonBase
                                    } ${showNotificationPanel || hasUnread ? 'dark:bg-indigo-950/70 dark:text-indigo-200 dark:shadow-none' : ''} ${!notificationsEnabled ? 'cursor-not-allowed opacity-60' : ''}`}
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
                                    className={`flex min-h-[44px] items-center gap-2 rounded-xl px-2 py-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:gap-3 sm:px-3 ${
                                        showDropdown
                                            ? 'bg-indigo-50 shadow-sm shadow-indigo-100/70 dark:bg-indigo-950/70 dark:shadow-none'
                                            : 'bg-white/80 hover:bg-white hover:shadow-sm dark:bg-slate-900/80 dark:hover:bg-slate-800'
                                    }`}
                                    aria-expanded={showDropdown}
                                    aria-haspopup="menu"
                                >
                                    <div className="hidden text-right sm:block">
                                        <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
                                            {user?.name}
                                        </p>
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
                                            {user?.role}
                                        </p>
                                    </div>

                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
                                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                </button>

                                {showDropdown ? (
                                    <div role="menu" aria-label="Account menu" className="absolute right-0 z-[60] mt-3 max-h-[calc(100vh-5rem)] w-[min(19rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_30px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:rounded-[26px]">
                                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                                                Account
                                            </p>
                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.name}</p>
                                            <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                                            <button
                                                type="button"
                                                onClick={() => setShowProfileEdit((current) => !current)}
                                                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                                                aria-expanded={showProfileEdit}
                                            >
                                                {showProfileEdit ? <X size={14} /> : <Edit3 size={14} />}
                                                {showProfileEdit ? 'Cancel edit' : 'Edit profile'}
                                            </button>
                                        </div>

                                        {showProfileEdit ? (
                                            <form onSubmit={handleProfileSubmit} className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                            Username
                                                        </label>
                                                        <input
                                                            required
                                                            type="text"
                                                            value={profileForm.name}
                                                            onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                            Email
                                                        </label>
                                                        <input
                                                            required
                                                            type="email"
                                                            value={profileForm.email}
                                                            onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                            Role
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={user?.role || 'User'}
                                                            readOnly
                                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowProfileEdit(false)}
                                                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={savingProfile}
                                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                                                    >
                                                        {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                        Save
                                                    </button>
                                                </div>
                                            </form>
                                        ) : null}

                                        <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                                                Display Settings
                                            </p>
                                            <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-950">
                                                {themeOptions.map((option) => {
                                                    const Icon = option.icon;
                                                    const isSelected = themeMode === option.value;

                                                    return (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => setThemeMode(option.value)}
                                                            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition ${
                                                                isSelected
                                                                    ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-200'
                                                                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                                                            }`}
                                                            aria-pressed={isSelected}
                                                        >
                                                            <Icon size={15} />
                                                            <span className="truncate">{option.label}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

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
                                                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                                                    >
                                                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                            <Icon size={16} />
                                                        </span>
                                                        {item.label}
                                                    </button>
                                                );
                                            })}

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    logout();
                                                    navigate('/login');
                                                }}
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
