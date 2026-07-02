import React, { useLayoutEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';

// These must match the SIDEBAR_EXPANDED_WIDTH / SIDEBAR_COLLAPSED_WIDTH
// constants in Sidebar.jsx (242px expanded, 68px collapsed).
const SIDEBAR_EXPANDED_PL  = 'lg:pl-[242px]';
const SIDEBAR_COLLAPSED_PL = 'lg:pl-[68px]';

const DashboardLayout = () => {
    const location = useLocation();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    useLayoutEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-[#f6f8fc] text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
            <Sidebar onDesktopCollapsedChange={setIsSidebarCollapsed} />
            <Navbar isSidebarCollapsed={isSidebarCollapsed} />

            <main
                className={`w-full min-w-0 overflow-x-hidden bg-[#f6f8fc] pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] pt-[76px] transition-all duration-300 dark:bg-slate-950 lg:pb-0 ${
                    isSidebarCollapsed ? SIDEBAR_COLLAPSED_PL : SIDEBAR_EXPANDED_PL
                }`}
            >
                <Outlet />
            </main>

            <MobileBottomNav />
        </div>
    );
};

export default DashboardLayout;
