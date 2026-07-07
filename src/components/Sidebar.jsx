import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    BarChart3,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Mail,
    Menu,
    PlusCircle,
    ScrollText,
    ShieldCheck,
    Upload,
    Users,
    X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from './ConfirmProvider';
import { normalizeRole } from '../utils/roles';

// ─── Constants ───────────────────────────────────────────────────────────────

const DESKTOP_COLLAPSE_KEY = 'workspaceSidebarCollapsed';
const SIDEBAR_EXPANDED_WIDTH = 'lg:w-[242px]';
const SIDEBAR_COLLAPSED_WIDTH = 'lg:w-[68px]';

// Base classes extracted to avoid rebuilding strings on every render
const NAV_ITEM_BASE =
    'group relative flex w-full items-center rounded-lg border text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70';
const NAV_ICON_BASE =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors duration-200';

// ─── NavItem — extracted as a proper component so React can memo it ───────────

const NavItem = memo(({ item, collapsed, mobile, onNavigate, isActive }) => {
    const Icon = item.icon;

    const handlePreload = useCallback(() => {
        item.preload?.().catch?.(() => {});
    }, [item]);

    const handleClick = useCallback(
        (event) => {
            if (isActive) event.preventDefault();
            if (mobile) onNavigate?.();
        },
        [isActive, mobile, onNavigate]
    );

    return (
        <NavLink
            to={item.path}
            title={collapsed ? item.title : undefined}
            aria-label={item.title}
            onMouseEnter={handlePreload}
            onFocus={handlePreload}
            onTouchStart={handlePreload}
            onClick={handleClick}
            className={`${NAV_ITEM_BASE} ${
                collapsed ? 'min-h-[42px] justify-center px-1 py-1' : 'min-h-[44px] gap-3 px-2.5 py-2'
            } ${
                isActive
                    ? 'border-blue-400/20 bg-blue-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)]'
                    : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.07] hover:text-white'
            }`}
        >
            {/* Active indicator bar */}
            <span
                aria-hidden="true"
                className={`absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full transition-all duration-200 ${
                    isActive
                        ? 'bg-white/80'
                        : 'bg-transparent group-hover:bg-slate-600/60'
                }`}
            />

            {/* Icon */}
            <span
                className={`${NAV_ICON_BASE} ${
                    isActive
                        ? 'border-white/20 bg-white/14 text-white'
                        : 'border-transparent bg-transparent text-slate-400 group-hover:text-slate-200'
                }`}
            >
                <Icon size={item.nested ? 16 : 17} strokeWidth={2.2} aria-hidden="true" />
            </span>

            {/* Label */}
            {!collapsed && (
                <div className="min-w-0 flex-1">
                    <p
                        className={`truncate text-[13px] leading-tight ${
                            item.nested ? 'font-medium' : 'font-semibold'
                        }`}
                    >
                        {item.title}
                    </p>
                    {item.description && !item.nested && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 group-hover:text-slate-400">
                            {item.description}
                        </p>
                    )}
                </div>
            )}
        </NavLink>
    );
});

// ─── Section label ─────────────────────────────────────────────────────────

const SectionLabel = memo(({ label }) => (
    <p className="mb-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
        {label}
    </p>
));

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const Sidebar = memo(({ onDesktopCollapsedChange }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const confirm = useConfirm();
    const desktopMenuRef = useRef(null);
    const mobileMenuRef = useRef(null);
    const scrollPositionsRef = useRef({ desktop: 0, mobile: 0 });

    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

    // ── Menu definitions ───────────────────────────────────────────────────
    const mainMenuItems = useMemo(
        () => [
            {
                title: 'Dashboard',
                icon: LayoutDashboard,
                path: '/dashboard',
                preload: () => import('../pages/Dashboard'),
                roles: ['Super Admin', 'Admin', 'Teacher'],
            },
            {
                title: 'View Incidents',
                icon: AlertCircle,
                path: '/incidents',
                preload: () => import('../pages/IncidentList'),
                roles: ['Super Admin', 'Admin', 'Teacher'],
            },
            {
                title: 'Create Incident',
                icon: PlusCircle,
                path: '/create-incident',
                preload: () => import('../pages/CreateIncident'),
                roles: ['Admin', 'Teacher'],
            },
        ],
        []
    );

    const manageMenuItems = useMemo(
        () => [
            {
                title: 'User Management',
                icon: Users,
                path: '/user-management',
                preload: () => import('../pages/UserManagement'),
                roles: ['Super Admin', 'Admin'],
            },
            {
                title: 'Student Upload',
                icon: GraduationCap,
                path: '/upload-students',
                preload: () => import('../pages/StudentUpload'),
                roles: ['Super Admin', 'Admin'],
            },
            {
                title: 'Incident Upload',
                icon: Upload,
                path: '/upload-incidents',
                preload: () => import('../pages/BulkUpload'),
                roles: ['Super Admin', 'Admin'],
            },
        ],
        []
    );

    const letterMenuItems = useMemo(
        () => [
            {
                title: 'Letter Templates',
                icon: FileText,
                path: '/letter-templates',
                preload: () => import('../pages/LetterTemplates'),
                roles: ['Super Admin', 'Admin', 'Teacher'],
            },
            {
                title: 'Issued Letters',
                icon: Mail,
                path: '/issued-letters',
                preload: () => import('../pages/IssuedLetters'),
                roles: ['Super Admin', 'Admin', 'Teacher'],
            },
        ],
        []
    );

    const reportsItems = useMemo(
        () => [
            { title: 'School Analytics', icon: BarChart3, path: '/analytics', preload: () => import('../pages/ProfessionalAnalytics'), roles: ['Super Admin', 'Admin'] },
            { title: 'Student Analytics', icon: ScrollText, path: '/student-analytics', preload: () => import('../pages/StudentAnalytics'), roles: ['Super Admin', 'Admin'] },
        ],
        []
    );

    const adminOnlyItems = useMemo(
        () => [
            {
                title: 'Activity Logs',
                icon: ClipboardList,
                path: '/logs',
                preload: () => import('../pages/Logs'),
                roles: ['Super Admin'],
            },
            {
                title: 'Academic Year Management',
                icon: CalendarDays,
                path: '/settings/academic-year',
                preload: () => import('../pages/AcademicYearManagement'),
                roles: ['Super Admin'],
            },
        ],
        []
    );

    // ── Derived ────────────────────────────────────────────────────────────
    const matchesPath = useCallback(
        (path) => {
            if (path === '/incidents') {
                return (
                    location.pathname === '/incidents' ||
                    location.pathname.startsWith('/incidents/')
                );
            }
            if (path === '/student-analytics') {
                return (
                    location.pathname === '/student-analytics' ||
                    location.pathname.startsWith('/student-analytics/')
                );
            }
            return location.pathname === path;
        },
        [location.pathname]
    );

    const normalizedRole = normalizeRole(user?.role);
    const filterByRole = useCallback(
        (items) => items.filter((item) => !item.roles || item.roles.includes(normalizedRole)),
        [normalizedRole]
    );

    const visibleMain = useMemo(() => filterByRole(mainMenuItems), [filterByRole, mainMenuItems]);
    const visibleManage = useMemo(() => filterByRole(manageMenuItems), [filterByRole, manageMenuItems]);
    const visibleLetters = useMemo(() => filterByRole(letterMenuItems), [filterByRole, letterMenuItems]);
    const visibleAdmin = useMemo(() => filterByRole(adminOnlyItems), [filterByRole, adminOnlyItems]);
    const visibleReports = useMemo(() => filterByRole(reportsItems), [filterByRole, reportsItems]);

    const closeMobile = useCallback(() => setIsMobileOpen(false), []);

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
        closeMobile();
        navigate('/login', { replace: true });
    }, [closeMobile, confirm, logout, navigate]);

    // ── Persistence / sync ─────────────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem(DESKTOP_COLLAPSE_KEY);
        if (stored) setIsDesktopCollapsed(stored === 'true');
    }, []);

    useEffect(() => {
        localStorage.setItem(DESKTOP_COLLAPSE_KEY, String(isDesktopCollapsed));
        onDesktopCollapsedChange?.(isDesktopCollapsed);
    }, [isDesktopCollapsed, onDesktopCollapsedChange]);

    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    // Restore scroll positions on navigation
    useLayoutEffect(() => {
        if (desktopMenuRef.current) {
            desktopMenuRef.current.scrollTop = scrollPositionsRef.current.desktop;
        }
        if (mobileMenuRef.current) {
            mobileMenuRef.current.scrollTop = scrollPositionsRef.current.mobile;
        }
    }, [location.pathname]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) setIsMobileOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ── Collapse toggle ────────────────────────────────────────────────────
    const toggleCollapsed = useCallback(() => {
        setIsDesktopCollapsed((prev) => !prev);
    }, []);

    // ── Render sidebar body ────────────────────────────────────────────────
    const renderSidebarBody = (mobile = false) => {
        const collapsed = mobile ? false : isDesktopCollapsed;
        const menuRef = mobile ? mobileMenuRef : desktopMenuRef;
        const scrollKey = mobile ? 'mobile' : 'desktop';

        const renderGroup = (items, label) => {
            if (items.length === 0) return null;
            return (
                <section aria-label={label}>
                    {!collapsed && <SectionLabel label={label} />}
                    <div className="space-y-0.5">
                        {items.map((item) => (
                            <NavItem
                                key={item.path}
                                item={item}
                                collapsed={collapsed}
                                mobile={mobile}
                                onNavigate={closeMobile}
                                isActive={matchesPath(item.path)}
                            />
                        ))}
                    </div>
                </section>
            );
        };

        const renderNavItems = (items) => {
            if (items.length === 0) return null;
            return (
                <div className="space-y-0.5">
                    {items.map((item) => (
                        <NavItem
                            key={item.path}
                            item={item}
                            collapsed={collapsed}
                            mobile={mobile}
                            onNavigate={closeMobile}
                            isActive={matchesPath(item.path)}
                        />
                    ))}
                </div>
            );
        };

        return (
            <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_30%),linear-gradient(180deg,#0a1730_0%,#071226_48%,#050d1c_100%)]">

                {/* ── Header ── */}
                <div
                    className={`border-b border-white/[0.06] ${
                        collapsed ? 'px-1.5 py-4' : 'px-4 py-5'
                    }`}
                >
                    <div
                        className={`flex items-center ${
                            collapsed ? 'flex-col justify-center gap-2' : 'justify-between gap-2'
                        }`}
                    >
                        {/* Brand */}
                        <div className={`flex min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
                            <div
                                className={`${
                                    collapsed ? 'h-9 w-9' : 'h-10 w-10'
                                } flex shrink-0 items-center justify-center rounded-xl border border-blue-300/20 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.32)]`}
                            >
                                <ShieldCheck size={18} aria-hidden="true" />
                            </div>
                            {!collapsed && (
                                <div className="min-w-0">
                                    <h1 className="truncate text-[15px] font-bold tracking-tight text-white">
                                        Incident Workspace
                                    </h1>
                                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                                        Staff Portal
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-1.5">
                            {!mobile && (
                                <button
                                    type="button"
                                    onClick={toggleCollapsed}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors duration-200 hover:border-blue-400/30 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                                    aria-label={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                >
                                    {isDesktopCollapsed ? (
                                        <ChevronRight size={15} aria-hidden="true" />
                                    ) : (
                                        <ChevronLeft size={15} aria-hidden="true" />
                                    )}
                                </button>
                            )}
                            {mobile && (
                                <button
                                    type="button"
                                    onClick={closeMobile}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/60 text-slate-400 transition-colors duration-200 hover:border-indigo-400/30 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                                    aria-label="Close navigation"
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Scrollable nav ── */}
                <div
                    ref={menuRef}
                    onScroll={(e) => {
                        scrollPositionsRef.current[scrollKey] = e.currentTarget.scrollTop;
                    }}
                    className={`flex-1 overflow-y-auto [scrollbar-color:rgba(100,116,139,0.4)_transparent] [scrollbar-width:thin] ${
                        collapsed ? 'px-1.5 py-4' : 'px-3 py-5'
                    }`}
                >
                    <nav aria-label="Sidebar navigation" className={collapsed ? 'space-y-3' : 'space-y-5'}>

                        {/* Incidents */}
                        {renderGroup(visibleMain, 'Incidents')}
                        {renderNavItems(visibleReports)}

                        {/* Manage (admin only) */}
                        {visibleManage.length > 0 && renderGroup(visibleManage, 'Manage')}

                        {/* Letters (admin only) */}
                        {visibleLetters.length > 0 && renderGroup(visibleLetters, 'Letters')}

                        {/* System (admin only) */}
                        {visibleAdmin.length > 0 && renderGroup(visibleAdmin, 'System')}
                    </nav>
                </div>

                {/* ── Footer: user + sign out ── */}
                <div
                    className={`border-t border-white/[0.07] ${
                        collapsed ? 'p-1.5' : 'p-3'
                    }`}
                >
                    {/* User chip */}
                    <div
                        className={`mb-1.5 rounded-lg border border-white/10 bg-white/[0.04] p-2 ${
                            collapsed ? 'flex justify-center' : ''
                        }`}
                    >
                        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
                            <div
                                aria-hidden="true"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold text-white shadow-[0_6px_20px_rgba(37,99,235,0.24)]"
                            >
                                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            {!collapsed && (
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-semibold leading-tight text-white">
                                        {user?.name}
                                    </p>
                                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        {normalizedRole || user?.role}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sign out */}
                    <button
                        type="button"
                        title={collapsed ? 'Sign Out' : undefined}
                        aria-label="Sign out"
                        onClick={handleSignOut}
                        className={`flex w-full items-center rounded-xl border border-transparent text-slate-400 transition-all duration-200 hover:border-rose-500/15 hover:bg-rose-500/10 hover:text-rose-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 ${
                            collapsed ? 'min-h-[42px] justify-center px-1 py-1' : 'min-h-[42px] gap-3 px-2.5 py-2'
                        }`}
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-900/60 text-slate-400 transition-colors duration-200">
                            <LogOut size={15} strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        {!collapsed && (
                            <span className="text-[13px] font-semibold">Sign Out</span>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Mobile hamburger */}
            <button
                type="button"
                onClick={() => setIsMobileOpen(true)}
                className={`fixed left-3 top-3 z-[72] inline-flex h-11 min-h-[44px] min-w-[44px] w-11 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-950 text-white shadow-[0_8px_32px_rgba(2,6,23,0.4)] transition-all duration-200 hover:border-indigo-400/40 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:left-4 sm:top-4 lg:hidden ${
                    isMobileOpen ? 'pointer-events-none opacity-0' : ''
                }`}
                aria-label="Open navigation menu"
                aria-expanded={isMobileOpen}
            >
                <Menu size={19} aria-hidden="true" />
            </button>

            {/* Desktop sidebar */}
            <div
                className={`fixed left-0 top-0 z-30 hidden h-screen lg:block ${
                    isDesktopCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH
                } transition-all duration-300`}
            >
                <aside
                    className="h-full overflow-hidden border-r border-slate-700/60 bg-slate-950 text-slate-100 shadow-[8px_0_24px_rgba(2,6,23,0.22)]"
                    aria-label="Main navigation"
                >
                    {renderSidebarBody()}
                </aside>
            </div>

            {/* Mobile overlay backdrop */}
            {isMobileOpen && (
                <button
                    type="button"
                    aria-label="Close navigation overlay"
                    onClick={closeMobile}
                    className="fixed inset-0 z-[65] bg-slate-950/75 backdrop-blur-sm lg:hidden"
                />
            )}

            {/* Mobile drawer */}
            <aside
                className={`fixed inset-y-0 left-0 z-[70] w-[min(280px,calc(100vw-1rem))] overflow-hidden rounded-r-2xl border border-slate-800/80 bg-slate-950/98 text-slate-100 shadow-[0_24px_60px_rgba(2,6,23,0.5)] backdrop-blur-xl transition-transform duration-250 lg:hidden ${
                    isMobileOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
                }`}
                aria-label="Mobile navigation"
                aria-hidden={!isMobileOpen}
            >
                {renderSidebarBody(true)}
            </aside>
        </>
    );
});

export default Sidebar;
