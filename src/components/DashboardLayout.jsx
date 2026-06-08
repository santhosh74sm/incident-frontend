import React, { useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';

// These must match the SIDEBAR_EXPANDED_WIDTH / SIDEBAR_COLLAPSED_WIDTH
// constants in Sidebar.jsx (268px expanded, 68px collapsed).
const SIDEBAR_EXPANDED_PL  = 'lg:pl-[268px]';
const SIDEBAR_COLLAPSED_PL = 'lg:pl-[68px]';

const DashboardLayout = () => {
    const location = useLocation();
    const mainRef = useRef(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    useLayoutEffect(() => {
        mainRef.current?.scrollTo({ top: 0, left: 0 });
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
            <Sidebar onDesktopCollapsedChange={setIsSidebarCollapsed} />
            <Navbar isSidebarCollapsed={isSidebarCollapsed} />

            <main
                ref={mainRef}
                className={`w-full min-w-0 overflow-x-hidden bg-slate-100 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] pt-20 transition-all duration-300 dark:bg-slate-950 sm:pt-24 lg:pb-0 lg:pt-20 ${
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
