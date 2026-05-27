import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, LayoutDashboard, ListFilter, PlusCircle, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const itemBase =
    'flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-[10px] font-semibold leading-tight transition-colors duration-200';

const MobileBottomNav = () => {
    const { user } = useAuth();

    if (!user) return null;

    const canReport = user.role === 'Admin' || user.role === 'Teacher';

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
            <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5">
                <NavLink to="/dashboard" className={linkClass} end>
                    <LayoutDashboard className="h-5 w-5 shrink-0" strokeWidth={2.1} aria-hidden />
                    <span>Dashboard</span>
                </NavLink>
                <NavLink to="/incidents" className={linkClass}>
                    <ListFilter className="h-5 w-5 shrink-0" strokeWidth={2.1} aria-hidden />
                    <span>Incidents</span>
                </NavLink>
                {canReport ? (
                    <NavLink to="/create-incident" className={linkClass}>
                        <PlusCircle className="h-5 w-5 shrink-0" strokeWidth={2.1} aria-hidden />
                        <span>Report</span>
                    </NavLink>
                ) : (
                    <button
                        type="button"
                        disabled
                        className={`${itemBase} cursor-not-allowed opacity-50`}
                        aria-label="Report incident unavailable"
                    >
                        <PlusCircle className="h-5 w-5 shrink-0" strokeWidth={2.1} aria-hidden />
                        <span>Report</span>
                    </button>
                )}
                <NavLink to="/analytics" className={linkClass}>
                    <BarChart3 className="h-5 w-5 shrink-0" strokeWidth={2.1} aria-hidden />
                    <span>Reports</span>
                </NavLink>
                {user.role === 'Admin' ? (
                    <NavLink to="/user-management" className={linkClass}>
                        <Users className="h-5 w-5 shrink-0" strokeWidth={2.1} aria-hidden />
                        <span>Staff</span>
                    </NavLink>
                ) : (
                    <button
                        type="button"
                        disabled
                        className={`${itemBase} cursor-not-allowed opacity-50`}
                        aria-label="Staff management unavailable"
                    >
                        <Users className="h-5 w-5 shrink-0" strokeWidth={2.1} aria-hidden />
                        <span>Staff</span>
                    </button>
                )}
            </div>
        </nav>
    );
};

export default MobileBottomNav;
