import React, { useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';

const DashboardLayout = () => {
    const location = useLocation();
    const mainRef = useRef(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    useLayoutEffect(() => {
        mainRef.current?.scrollTo({ top: 0, left: 0 });
    }, [location.pathname]);

    return (
        <div className="min-h-screen overflow-hidden bg-slate-100 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
            <Sidebar onDesktopCollapsedChange={setIsSidebarCollapsed} />
            <Navbar isSidebarCollapsed={isSidebarCollapsed} />

            <main
                ref={mainRef}
                className={`h-screen w-full min-w-0 overflow-y-auto overflow-x-hidden bg-slate-100 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] pt-20 transition-all duration-300 dark:bg-slate-950 sm:pt-24 lg:pb-0 lg:pt-20 ${
                    isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[280px]'
                }`}
            >
                <Outlet />
            </main>

            <MobileBottomNav />
        </div>
    );
};

export default DashboardLayout;
