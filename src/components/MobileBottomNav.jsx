import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, LayoutDashboard, ListFilter, PlusCircle, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const itemBase =
    'flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-semibold leading-tight transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

const MobileBottomNav = () => {
    const { user } = useAuth();

    if (!user) return null;

    const canReport = ['Admin', 'Teacher'].includes(user.role);
    const canManageStaff = ['Super Admin', 'Admin'].includes(user.role);
    const navItems = [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/incidents', label: 'Incidents', icon: ListFilter },
        canReport ? { to: '/create-incident', label: 'Report', icon: PlusCircle } : null,
        { to: '/analytics', label: 'Reports', icon: BarChart3 },
        canManageStaff ? { to: '/user-management', label: 'Staff', icon: Users } : null,
    ].filter(Boolean);

    const linkClass = ({ isActive }) =>
        `${itemBase} ${
            isActive
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
        }`;

    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-2 pt-2 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
            aria-label="Mobile workspace navigation"
        >
            <div
                className="mx-auto grid max-w-lg items-stretch gap-1"
                style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
            >
                {navItems.map(({ to, label, icon: Icon, end }) => (
                    <NavLink key={to} to={to} className={linkClass} end={end}>
                        <Icon className="h-5 w-5 shrink-0" strokeWidth={2.1} aria-hidden />
                        <span className="max-w-full truncate">{label}</span>
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
