import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    AlertCircle,
    BarChart3,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileText,
    LayoutDashboard,
    LogOut,
    Mail,
    Menu,
    PlusCircle,
    ShieldCheck,
    Upload,
    Users,
    X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DESKTOP_COLLAPSE_KEY = 'workspaceSidebarCollapsed';
const SIDEBAR_EXPANDED_WIDTH = 'lg:w-[280px]';
const SIDEBAR_COLLAPSED_WIDTH = 'lg:w-[72px]';
const navItemShell =
    'group relative flex w-full items-center rounded-lg border text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70';
const navIconShell =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all duration-200';

const Sidebar = memo(({ onDesktopCollapsedChange }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const desktopMenuRef = useRef(null);
    const mobileMenuRef = useRef(null);
    const scrollPositionsRef = useRef({ desktop: 0, mobile: 0 });
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
    const [openAnalytics, setOpenAnalytics] = useState(false);

    const menuItems = useMemo(
        () => [
            { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['Super Admin', 'Admin', 'Teacher'] },
            { title: 'All Incidents', icon: AlertCircle, path: '/incidents', roles: ['Super Admin', 'Admin', 'Teacher'] },
            { title: 'Report Incident', icon: PlusCircle, path: '/create-incident', roles: ['Admin', 'Teacher'] },
            { title: 'Student Upload', icon: Upload, path: '/upload-students', roles: ['Super Admin', 'Admin'] },
            { title: 'Incident Upload', icon: Upload, path: '/upload-incidents', roles: ['Super Admin', 'Admin'] },
            { title: 'Official letters', icon: FileText, path: '/letter-templates', roles: ['Super Admin', 'Admin'] },
            { title: 'Issued Letters', icon: Mail, path: '/issued-letters', roles: ['Super Admin', 'Admin'] },
        ],
        []
    );

    const analyticsItems = useMemo(
        () => [
            { title: 'School reports', icon: BarChart3, path: '/analytics' },
            { title: 'Student summaries', icon: Users, path: '/student-analytics' },
        ],
        []
    );

    const isAnalyticsActive = location.pathname.includes('analytics');

    useEffect(() => {
        const storedState = localStorage.getItem(DESKTOP_COLLAPSE_KEY);
        if (storedState) {
            setIsDesktopCollapsed(storedState === 'true');
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(DESKTOP_COLLAPSE_KEY, String(isDesktopCollapsed));
        onDesktopCollapsedChange?.(isDesktopCollapsed);
    }, [isDesktopCollapsed, onDesktopCollapsedChange]);

    useEffect(() => {
        if (isAnalyticsActive) {
            setOpenAnalytics(true);
        }
        setIsMobileOpen(false);
    }, [isAnalyticsActive, location.pathname]);

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
            if (window.innerWidth >= 1024) {
                setIsMobileOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const matchesPath = useCallback((path) => {
        if (path === '/incidents') {
            return location.pathname === '/incidents' || location.pathname.startsWith('/incidents/');
        }

        if (path === '/student-analytics') {
            return location.pathname === '/student-analytics' || location.pathname.startsWith('/student-analytics/');
        }

        return location.pathname === path;
    }, [location.pathname]);

    const visibleMenuItems = useMemo(
        () => menuItems.filter((item) => item.roles.includes(user?.role)),
        [menuItems, user?.role]
    );

    const handleNavItemClick = useCallback((event, path, mobile = false) => {
        if (matchesPath(path)) {
            event.preventDefault();
        }

        if (mobile) {
            setIsMobileOpen(false);
        }
    }, [matchesPath]);

    const renderNavItem = (item, nested = false, collapsed = isDesktopCollapsed, mobile = false) => {
        const Icon = item.icon;
        const isActive = matchesPath(item.path);

        return (
            <NavLink
                key={item.path}
                to={item.path}
                title={collapsed ? item.title : undefined}
                onClick={(event) => handleNavItemClick(event, item.path, mobile)}
                className={`${navItemShell} ${
                    collapsed ? 'min-h-[42px] justify-center px-1 py-1' : 'min-h-[46px] gap-3 px-2.5 py-2'
                } ${
                    isActive
                        ? 'border-indigo-400/30 bg-indigo-500/15 text-white shadow-[0_16px_30px_rgba(15,23,42,0.28)]'
                        : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 hover:text-white'
                }`}
            >
                <span
                    className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full transition-all duration-200 ${
                        isActive
                            ? 'bg-indigo-400 shadow-[0_0_22px_rgba(129,140,248,0.72)]'
                            : 'bg-transparent group-hover:bg-slate-600'
                    }`}
                />

                <span
                    className={`${navIconShell} ${
                        isActive
                            ? 'border-indigo-300/30 bg-indigo-500/20 text-white'
                            : 'border-slate-700 bg-slate-900/75 text-slate-300 group-hover:border-slate-600 group-hover:bg-slate-800 group-hover:text-white'
                    }`}
                >
                    <Icon size={nested ? 18 : 19} strokeWidth={2.1} />
                </span>

                {!collapsed ? (
                    <div className="min-w-0 flex-1">
                        <p className={`truncate ${nested ? 'text-sm font-medium' : 'text-sm font-semibold'}`}>
                            {item.title}
                        </p>
                    </div>
                ) : null}
            </NavLink>
        );
    };

    const renderSidebarBody = (mobile = false) => {
        const collapsed = mobile ? false : isDesktopCollapsed;
        const menuRef = mobile ? mobileMenuRef : desktopMenuRef;
        const scrollKey = mobile ? 'mobile' : 'desktop';

        return (
            <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.18),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.99)_44%,rgba(2,6,23,1)_100%)]">
                <div className={`border-b border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.04)] ${collapsed ? 'px-1.5 py-3' : 'px-3 py-3.5'}`}>
                    <div className={`flex items-center ${collapsed ? 'flex-col justify-center gap-2' : 'justify-between gap-3'}`}>
                        <div className={`flex min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                            <div className={`${collapsed ? 'h-10 w-10' : 'h-11 w-11'} flex shrink-0 items-center justify-center rounded-xl border border-indigo-300/25 bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-[0_18px_34px_rgba(79,70,229,0.3)]`}>
                                <ShieldCheck size={22} />
                            </div>

                            {!collapsed ? (
                                <div className="min-w-0">
                                    <h1 className="truncate text-lg font-bold tracking-tight text-white">
                                        Incident Workspace
                                    </h1>
                                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                                        Staff Portal
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                            {!mobile ? (
                                <button
                                    type="button"
                                    onClick={() => setIsDesktopCollapsed((current) => !current)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/75 text-slate-200 transition-all duration-200 hover:border-indigo-400/40 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                                    aria-label={isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                >
                                    {isDesktopCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                                </button>
                            ) : null}

                            {mobile ? (
                                <button
                                    type="button"
                                    onClick={() => setIsMobileOpen(false)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/75 text-slate-200 transition-all duration-200 hover:border-indigo-400/40 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                                    aria-label="Close navigation"
                                >
                                    <X size={18} />
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div
                    ref={menuRef}
                    onScroll={(event) => {
                        scrollPositionsRef.current[scrollKey] = event.currentTarget.scrollTop;
                    }}
                    className={`flex-1 overflow-y-auto [scrollbar-color:rgba(148,163,184,0.55)_transparent] [scrollbar-width:thin] ${collapsed ? 'px-1.5 py-3' : 'px-2.5 py-3'}`}
                >
                    <div className={collapsed ? 'space-y-3' : 'space-y-4'}>
                        <section>
                            {!collapsed ? (
                                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                                    Main Menu
                                </p>
                            ) : null}

                            <div className={collapsed ? 'space-y-1' : 'space-y-1.5'}>
                                {visibleMenuItems.map((item) => renderNavItem(item, false, collapsed, mobile))}
                            </div>
                        </section>

                        <section className={collapsed ? 'border-t border-white/10 pt-3' : 'border-t border-white/10 pt-4'}>
                            {!collapsed ? (
                                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                                    Reports & trends
                                </p>
                            ) : null}

                            <button
                                type="button"
                                title={collapsed ? 'Reports' : undefined}
                                onClick={() => setOpenAnalytics((current) => !current)}
                                className={`${navItemShell} ${
                                    collapsed ? 'min-h-[42px] justify-center px-1 py-1' : 'min-h-[46px] gap-3 px-2.5 py-2'
                                } ${
                                    isAnalyticsActive
                                        ? 'border-indigo-400/30 bg-indigo-500/15 text-white'
                                        : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/80 hover:text-white'
                                }`}
                            >
                                <span
                                    className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full transition-all duration-200 ${
                                        isAnalyticsActive
                                            ? 'bg-indigo-400 shadow-[0_0_22px_rgba(129,140,248,0.72)]'
                                            : 'bg-transparent group-hover:bg-slate-600'
                                    }`}
                                />

                                <span
                                    className={`${navIconShell} ${
                                        isAnalyticsActive
                                            ? 'border-indigo-300/30 bg-indigo-500/20 text-white'
                                            : 'border-slate-700 bg-slate-900/75 text-slate-300 group-hover:border-slate-600 group-hover:bg-slate-800 group-hover:text-white'
                                    }`}
                                >
                                    <BarChart3 size={19} strokeWidth={2.1} />
                                </span>

                                {!collapsed ? (
                                    <>
                                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">Reports & trends</span>
                                        <ChevronDown
                                            size={16}
                                            className={`shrink-0 text-slate-400 transition-all duration-200 ${
                                                openAnalytics ? 'rotate-180 text-slate-300' : ''
                                            }`}
                                        />
                                    </>
                                ) : null}
                            </button>

                            {openAnalytics ? (
                                <div className={`${collapsed ? 'mt-1.5 space-y-1' : 'mt-2 space-y-1.5 pl-2'}`}>
                                    {analyticsItems.map((item) => renderNavItem(item, true, collapsed, mobile))}
                                </div>
                            ) : null}
                        </section>
                    </div>
                </div>

                <div className={`border-t border-white/10 ${collapsed ? 'p-1.5' : 'p-2.5'}`}>
                    <div
                        className={`rounded-xl border border-slate-700/90 bg-slate-900/75 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                            collapsed ? 'flex justify-center' : ''
                        }`}
                    >
                        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-sm font-bold text-white shadow-[0_18px_34px_rgba(79,70,229,0.24)]">
                                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>

                            {!collapsed ? (
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
                                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                        {user?.role}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <button
                        type="button"
                        title={collapsed ? 'Sign Out' : undefined}
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        className={`mt-1.5 flex w-full items-center rounded-lg border border-transparent text-slate-400 transition-all duration-200 hover:border-rose-400/15 hover:bg-rose-500/12 hover:text-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70 ${
                            collapsed ? 'justify-center' : 'gap-3'
                        } ${collapsed ? 'min-h-[42px] px-1 py-1' : 'min-h-[46px] px-2.5 py-2'}`}
                    >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/75 text-slate-400 transition-all duration-200">
                            <LogOut size={18} strokeWidth={2.1} />
                        </span>
                        {!collapsed ? <span className="text-sm font-semibold">Sign Out</span> : null}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setIsMobileOpen(true)}
                className={`fixed left-3 top-3 z-[72] inline-flex h-11 min-h-[44px] min-w-[44px] w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-white shadow-[0_18px_40px_rgba(2,6,23,0.45)] transition-all duration-200 hover:border-indigo-400/40 hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:left-4 sm:top-4 lg:hidden ${
                    isMobileOpen ? 'pointer-events-none opacity-0' : ''
                }`}
                aria-label="Open navigation menu"
            >
                <Menu size={20} />
            </button>

            <div
                className={`fixed left-0 top-0 z-30 hidden h-screen lg:block ${
                    isDesktopCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH
                }`}
            >
                <aside className="h-full overflow-hidden border-r border-slate-700/90 bg-slate-950 text-slate-100 shadow-[10px_0_30px_rgba(2,6,23,0.28)] backdrop-blur-xl">
                    {renderSidebarBody()}
                </aside>
            </div>

            {isMobileOpen ? (
                <button
                    type="button"
                    aria-label="Close navigation overlay"
                    onClick={() => setIsMobileOpen(false)}
                    className="fixed inset-0 z-[65] bg-slate-950/78 backdrop-blur-sm lg:hidden"
                />
            ) : null}

            <aside
                className={`fixed inset-y-0 left-0 z-[70] w-[min(294px,calc(100vw-1.25rem))] overflow-hidden rounded-r-2xl border border-slate-800/90 bg-slate-950/95 text-slate-100 shadow-[0_30px_70px_rgba(2,6,23,0.5)] backdrop-blur-xl transition-all duration-200 lg:hidden ${
                    isMobileOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
                }`}
            >
                {renderSidebarBody(true)}
            </aside>
        </>
    );
});

export default Sidebar;
