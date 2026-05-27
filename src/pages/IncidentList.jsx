import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Eye,
    FileText,
    ShieldCheck,
    User as UserIcon,
    Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { UnifiedDateInput, UnifiedFilterBar, UnifiedMultiSelect, UnifiedSearchInput } from '../components/UnifiedFilters';
import {
    DashboardHero,
    DashboardPageSkeleton,
    DashboardPanel,
    DashboardStatCard,
    EmptyStatePanel,
} from '../components/analytics/DashboardPrimitives';
import { buildIncidentFilterParams, getIncidentTimestamp, REQUEST_CONFIG, resolveHandlerLabel } from '../utils/analytics';
import apiClient from '../config/apiClient';
import {
    migrateIncidentStorageForUser,
    pruneIncidentStorage,
    readUserList,
    writeUserList,
} from '../utils/userStorage';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Closed'];
const READ_STATUS_OPTIONS = ['All', 'Unread', 'Read'];

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return 'N/A';
    }
};

const statusPill = (status, overrides = {}) => {
    if (overrides.pending) return 'border-red-200 bg-red-50 text-red-700';
    if (overrides.closureRequested) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'Closed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'In Progress') return 'border-blue-200 bg-blue-50 text-blue-700';
    return 'border-orange-200 bg-orange-50 text-orange-700';
};

const IncidentList = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { notifications } = useNotifications();

    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState([]);
    const [classFilter, setClassFilter] = useState([]);
    const [sectionFilter, setSectionFilter] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [categoryList, setCategoryList] = useState([]);
    const [classList, setClassList] = useState([]);
    const [sectionList, setSectionList] = useState([]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [readIncidents, setReadIncidents] = useState([]);
    const [priorityIncidents, setPriorityIncidents] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [readStatusFilter, setReadStatusFilter] = useState('All');

    const config = REQUEST_CONFIG;

    useEffect(() => {
        if (!user?._id) {
            setReadIncidents([]);
            setPriorityIncidents([]);
            return;
        }

        migrateIncidentStorageForUser(user._id);
        pruneIncidentStorage(user._id);
        setReadIncidents(readUserList('readIncidents', user._id));
        setPriorityIncidents(readUserList('priorityIncidents', user._id));
    }, [user?._id]);

    const allStaffOptions = useMemo(
        // Show a single unified "Administration" entry for all admin accounts;
        // teachers are listed individually by name.
        () => ['Administration', ...staffList.filter((staff) => !['Super Admin', 'Admin', 'super_admin', 'admin'].includes(staff.role)).map((staff) => staff.name)],
        [staffList]
    );

    const fetchIncidents = useCallback(async (options = { reset: false }) => {
        if (!user?._id) return;

        try {
            setLoading(true);
            setError(null);
            const requestConfig = { ...config };

            if (!options?.reset) {
                const allSelected = allStaffOptions.length > 0 && selectedStaff.length === allStaffOptions.length;
                const administrationSelected = selectedStaff.includes('Administration');
                const selectedTeacherIds =
                    selectedStaff.length > 0 && !allSelected
                        ? staffList
                            .filter((staff) => !['Super Admin', 'Admin', 'super_admin', 'admin'].includes(staff.role))
                            .filter((staff) => selectedStaff.includes(staff.name))
                            .map((staff) => staff._id)
                        : [];

                const params = buildIncidentFilterParams({
                    dateRange: { start: dateRange.start, end: dateRange.end },
                    statuses: statusFilter,
                    classes: classFilter,
                    sections: sectionFilter,
                    types: categoryFilter,
                    staffIds: selectedTeacherIds,
                    // includeAdminRole: true fetches all incidents for ANY admin user
                    // (null handler + every admin userId), not just unassigned ones.
                    includeAdminRole: selectedStaff.length > 0 && !allSelected && administrationSelected,
                    includeUnassigned: false,
                });

                if (params.toString()) {
                    requestConfig.params = params;
                }
            }

            const { data } = await apiClient.get('/api/incidents', requestConfig);
            setIncidents(Array.isArray(data) ? data : []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Failed to load incidents.');
        } finally {
            setLoading(false);
        }
    }, [allStaffOptions, categoryFilter, classFilter, config, dateRange.end, dateRange.start, sectionFilter, selectedStaff, staffList, statusFilter, user?._id]);

    const fetchStaff = useCallback(async () => {
        if (!user?._id) return;
        try {
            const { data } = await apiClient.get('/api/auth/users', config);
            setStaffList(Array.isArray(data) ? data : []);
        } catch {
            setStaffList([]);
        }
    }, [config, user?._id]);

    const fetchCategories = useCallback(async () => {
        if (!user?._id) return;
        try {
            const { data } = await apiClient.get('/api/incidents/categories', config);
            const categories = Array.isArray(data)
                ? data.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
                : [];
            setCategoryList(categories);
        } catch {
            setCategoryList([]);
        }
    }, [config, user?._id]);

    const fetchClasses = useCallback(async () => {
        if (!user?._id) return;
        try {
            const { data } = await apiClient.get('/api/incidents/classes', config);
            const classes = Array.isArray(data) ? data : [];
            if (classes.length === 0) {
                setClassList(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
                return;
            }

            const sortedClasses = classes.sort((a, b) => {
                const aNum = parseInt(a, 10);
                const bNum = parseInt(b, 10);
                if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
                return a.localeCompare(b);
            });
            setClassList(sortedClasses);
        } catch {
            setClassList(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
        }
    }, [config, user?._id]);

    const fetchSections = useCallback(async () => {
        if (!user?._id) return;
        try {
            const { data } = await apiClient.get('/api/incidents/sections', config);
            const sections = Array.isArray(data) ? data : [];
            setSectionList(sections.length > 0 ? sections : ['A', 'B', 'C', 'D', 'E']);
        } catch {
            setSectionList(['A', 'B', 'C', 'D', 'E']);
        }
    }, [config, user?._id]);

    useEffect(() => {
        fetchStaff();
        fetchCategories();
        fetchClasses();
        fetchSections();
    }, [fetchCategories, fetchClasses, fetchSections, fetchStaff]);

    useEffect(() => {
        fetchIncidents();
    }, [categoryFilter, classFilter, dateRange.end, dateRange.start, fetchIncidents, sectionFilter, selectedStaff, statusFilter, user?._id]);

    useEffect(() => {
        if (!notifications || notifications.length === 0) return;
        
        const incidentIds = notifications
            .filter((notification) => notification.incident?._id)
            .map((notification) => notification.incident._id);

        setPriorityIncidents((current) => {
            const next = [...new Set([...current, ...incidentIds])];
            writeUserList('priorityIncidents', user?._id, next);
            return next;
        });
    }, [notifications, user?._id]);

    const markAsRead = useCallback((incidentId) => {
        setReadIncidents((current) => {
            const next = [...new Set([...current, incidentId])];
            writeUserList('readIncidents', user?._id, next);
            return next;
        });

        setPriorityIncidents((current) => {
            const next = current.filter((id) => id !== incidentId);
            writeUserList('priorityIncidents', user?._id, next);
            return next;
        });
    }, [user?._id]);

    const isPriority = useCallback((incident) => {
        const incidentId = incident._id || incident.id;
        return priorityIncidents.includes(incidentId);
    }, [priorityIncidents]);

    const isUnread = useCallback((incident) => {
        const incidentId = incident._id || incident.id;
        return !readIncidents.includes(incidentId);
    }, [readIncidents]);

    const filteredIncidents = useMemo(() => {
        const query = (searchQuery || '').toLowerCase().trim();
        let list = [...incidents];

        if (query) {
            list = list.filter((incident) => {
                const titleMatch = (incident.title || '').toLowerCase().includes(query);
                const admissionMatch = String(incident.admissionNo || incident.adNo || '').toLowerCase().includes(query);
                const students = Array.isArray(incident.studentsInvolved)
                    ? incident.studentsInvolved
                    : incident.studentsInvolved
                        ? [String(incident.studentsInvolved)]
                        : [];
                const studentMatch = students.some((student) => String(student).toLowerCase().includes(query));
                return titleMatch || studentMatch || admissionMatch;
            });
        }

        if (activeTab === 'highPriority') {
            list = list.filter((incident) => incident.isHighPriority === true);
        }

        if (readStatusFilter === 'Unread') {
            list = list.filter((incident) => isUnread(incident));
        } else if (readStatusFilter === 'Read') {
            list = list.filter((incident) => !isUnread(incident));
        }

        list.sort((a, b) => {
            const aPriority = isPriority(a) || isUnread(a);
            const bPriority = isPriority(b) || isUnread(b);
            if (aPriority && !bPriority) return -1;
            if (!aPriority && bPriority) return 1;

            const aDate = new Date(getIncidentTimestamp(a) || 0).getTime();
            const bDate = new Date(getIncidentTimestamp(b) || 0).getTime();
            return bDate - aDate;
        });

        return list;
    }, [activeTab, incidents, isPriority, isUnread, readStatusFilter, searchQuery]);

    const hasActiveFilters = Boolean(
        statusFilter.length > 0 ||
        selectedStaff.length > 0 ||
        categoryFilter.length > 0 ||
        classFilter.length > 0 ||
        sectionFilter.length > 0 ||
        dateRange.start ||
        dateRange.end ||
        searchQuery ||
        readStatusFilter !== 'All'
    );

    const unreadCount = useMemo(
        () => incidents.filter((incident) => isUnread(incident)).length,
        [incidents, isUnread]
    );

    const summary = useMemo(() => ({
        total: filteredIncidents.length,
        open: filteredIncidents.filter((incident) => incident.status === 'Open').length,
        inProgress: filteredIncidents.filter((incident) => incident.status === 'In Progress').length,
        closed: filteredIncidents.filter((incident) => incident.status === 'Closed').length,
        highPriority: filteredIncidents.filter((incident) => incident.isHighPriority === true).length,
    }), [filteredIncidents]);

    const resetFilters = useCallback(() => {
        setStatusFilter([]);
        setSelectedStaff([]);
        setCategoryFilter([]);
        setClassFilter([]);
        setSectionFilter([]);
        setSearchQuery('');
        setDateRange({ start: '', end: '' });
        setActiveTab('all');
        setReadStatusFilter('All');
        setLoading(true);
        fetchIncidents({ reset: true });
    }, [fetchIncidents]);

    if (loading && incidents.length === 0) {
        return (
            <div className="flex min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                        <div className="mx-auto max-w-[1600px]">
                            <DashboardPageSkeleton />
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
            <div className="flex min-w-0 flex-1 flex-col min-w-0">
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-6">
                        <DashboardHero
                            eyebrow="Incidents"
                            title="All incidents"
                            description="Find students by name or admission number, narrow the list with simple filters, and open any case in full detail."
                            icon={ShieldCheck}
                            meta={(
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                                        {summary.total} result{summary.total === 1 ? '' : 's'} in current view
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                                        {summary.highPriority} high-priority item{summary.highPriority === 1 ? '' : 's'}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                                        {unreadCount} unread incident{unreadCount === 1 ? '' : 's'}
                                    </span>
                                </div>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <DashboardStatCard title="Results" value={summary.total} icon={FileText} tone="slate" helper="Matches your search and filters" />
                            <DashboardStatCard title="Open" value={summary.open} icon={AlertTriangle} tone="amber" helper="Waiting for first action" />
                            <DashboardStatCard title="In Progress" value={summary.inProgress} icon={Clock} tone="blue" helper="Currently being handled" />
                            <DashboardStatCard title="Closed" value={summary.closed} icon={CheckCircle} tone="emerald" helper="Resolved within scope" />
                        </div>

                        <DashboardPanel bodyClassName="p-0">
                            <div className="flex flex-col gap-2 md:flex-row">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('all')}
                                    className={`flex-1 border-b px-5 py-4 text-sm font-semibold transition ${
                                        activeTab === 'all'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200'
                                            : 'border-slate-100 text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        All Incidents
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                                            {incidents.length}
                                        </span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('highPriority')}
                                    className={`flex-1 border-b px-5 py-4 text-sm font-semibold transition ${
                                        activeTab === 'highPriority'
                                            ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200'
                                            : 'border-slate-100 text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <AlertTriangle size={16} />
                                        High Priority
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${activeTab === 'highPriority' ? 'bg-amber-500 text-white' : summary.highPriority > 0 ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                                            {summary.highPriority}
                                        </span>
                                    </span>
                                </button>
                            </div>
                        </DashboardPanel>

                        <UnifiedFilterBar
                            title="Find records"
                            hasActiveFilters={hasActiveFilters}
                            onReset={resetFilters}
                            actions={loading ? (
                                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                                    Updating
                                </span>
                            ) : null}
                        >
                            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-5">
                                <div className="min-w-0 xl:col-span-2">
                                    <UnifiedSearchInput
                                        label="Student Name or Admission Number"
                                        value={searchQuery}
                                        onChange={setSearchQuery}
                                        placeholder="Search by student name, admission number, or incident title"
                                    />
                                </div>
                                <UnifiedDateInput
                                    label="From Date"
                                    value={dateRange.start}
                                    onChange={(value) => setDateRange((current) => ({ ...current, start: value }))}
                                />
                                <UnifiedDateInput
                                    label="To Date"
                                    value={dateRange.end}
                                    onChange={(value) => setDateRange((current) => ({ ...current, end: value }))}
                                />
                                <UnifiedMultiSelect
                                    label="Status"
                                    options={STATUS_OPTIONS}
                                    selected={statusFilter}
                                    onChange={setStatusFilter}
                                    placeholder="All Status"
                                    searchPlaceholder="Search status..."
                                />
                            </div>

                            <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                                {user?.role !== 'Teacher' ? (
                                    <UnifiedMultiSelect
                                        label="Staff Members"
                                        options={allStaffOptions}
                                        selected={selectedStaff}
                                        onChange={setSelectedStaff}
                                        placeholder="All Staff"
                                        searchPlaceholder="Search staff..."
                                    />
                                ) : (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Scope</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.name}</p>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Teacher view is locked to your assignments.</p>
                                    </div>
                                )}
                                <UnifiedMultiSelect
                                    label="Incident Category"
                                    options={categoryList}
                                    selected={categoryFilter}
                                    onChange={setCategoryFilter}
                                    placeholder="All Categories"
                                    searchPlaceholder="Search category..."
                                />
                                <UnifiedMultiSelect
                                    label="Class"
                                    options={classList}
                                    selected={classFilter}
                                    onChange={setClassFilter}
                                    placeholder="All Classes"
                                    searchPlaceholder="Search class..."
                                />
                                <UnifiedMultiSelect
                                    label="Section"
                                    options={sectionList}
                                    selected={sectionFilter}
                                    onChange={setSectionFilter}
                                    placeholder="All Sections"
                                    searchPlaceholder="Search section..."
                                />
                                <div className="min-w-0">
                                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Read Status</p>
                                    <div className="flex min-h-[44px] flex-wrap overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                        {READ_STATUS_OPTIONS.map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setReadStatusFilter(opt)}
                                                className={`flex-1 text-xs font-semibold transition-all duration-150 ${
                                                    readStatusFilter === opt
                                                        ? opt === 'Unread'
                                                            ? 'bg-blue-600 text-white'
                                                            : opt === 'Read'
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'bg-slate-800 text-white'
                                                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </UnifiedFilterBar>

                        {error ? (
                            <DashboardPanel title="Unable to Load Incidents" description={error} icon={AlertTriangle}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLoading(true);
                                        fetchIncidents();
                                    }}
                                    className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                                >
                                    Retry
                                </button>
                            </DashboardPanel>
                        ) : null}

                        {!error && filteredIncidents.length === 0 ? (
                            <EmptyStatePanel
                                title="No incidents found"
                                description={incidents.length === 0 ? 'There are no incidents in the system yet.' : 'No incidents match your current filters.'}
                                action={hasActiveFilters ? (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                                    >
                                        Clear Filters
                                    </button>
                                ) : null}
                            />
                        ) : null}

                        {!error && filteredIncidents.length > 0 ? (
                            <DashboardPanel
                                title="Incident Results"
                                description="High-contrast incident cards with standardized pills for fast scanning and action."
                                icon={FileText}
                            >
                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                    {filteredIncidents.map((incident) => {
                                        const isPendingApproval = ['Super Admin', 'Admin'].includes(user?.role) && incident.approvalStatus === 'Pending';
                                        const isClosureRequest = ['Super Admin', 'Admin'].includes(user?.role) && incident.closureRequested && incident.status !== 'Closed';
                                        const isHighPriority = incident.isHighPriority === true;
                                        const priority = isPriority(incident) || isHighPriority;
                                        const unread = isUnread(incident);
                                        const studentsDisplay = incident.studentDetails?.name
                                            ? incident.studentDetails.name
                                            : Array.isArray(incident.studentsInvolved)
                                                ? incident.studentsInvolved[0] ?? 'N/A'
                                                : incident.studentsInvolved
                                                    ? String(incident.studentsInvolved)
                                                    : 'N/A';
                                        const incidentDate = getIncidentTimestamp(incident);
                                        const badgeLabel = isPendingApproval ? 'Pending Approval' : isClosureRequest ? 'Seal Ready' : (incident.status === 'In Progress' ? 'In Progress' : incident.status);

                                        return (
                                            <div
                                                key={incident._id}
                                                className={`rounded-[26px] border bg-white/95 p-5 shadow-md shadow-slate-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900/95 dark:shadow-slate-950/30 ${
                                                    priority ? 'border-amber-200 ring-1 ring-amber-200/70 dark:border-amber-500/40 dark:ring-amber-500/20' : unread ? 'border-blue-200 ring-1 ring-blue-200/70 dark:border-blue-500/40 dark:ring-blue-500/20' : 'border-white/70 dark:border-slate-800'
                                                }`}
                                            >
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusPill(incident.status, { pending: isPendingApproval, closureRequested: isClosureRequest })}`}>
                                                                {badgeLabel}
                                                            </span>
                                                            {isHighPriority ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                                                                    <Zap size={11} />
                                                                    High Priority
                                                                </span>
                                                            ) : null}
                                                            {unread ? (
                                                                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-200">
                                                                    New
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{formatDate(incidentDate)}</span>
                                                    </div>

                                                    <div>
                                                        <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">{incident.title || 'Untitled Incident'}</h3>
                                                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                                            Admission No: <span className="font-semibold text-slate-700 dark:text-slate-200">{incident.admissionNo || 'N/A'}</span>
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Student</p>
                                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{studentsDisplay}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Assigned To</p>
                                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{resolveHandlerLabel(incident)}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Category</p>
                                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{incident.category || 'Uncategorized'}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Location</p>
                                                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{incident.location || 'Not specified'}</p>
                                                        </div>
                                                    </div>

                                                    {incident.rejectionReason ? (
                                                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
                                                            <span className="font-semibold">Review note:</span> {incident.rejectionReason}
                                                        </div>
                                                    ) : null}

                                                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-700 dark:bg-slate-800">
                                                                <UserIcon size={14} />
                                                                Class {incident.class || 'N/A'} - Section {incident.section || 'N/A'}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                markAsRead(incident._id || incident.id);
                                                                navigate(`/incidents/${incident._id}`);
                                                            }}
                                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                                                        >
                                                            <Eye size={15} />
                                                            View Incident
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </DashboardPanel>
                        ) : null}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default memo(IncidentList);
