import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BookOpen,
    CheckCircle,
    Clock,
    Eye,
    FileText,
    MapPin,
    ShieldCheck,
    User as UserIcon,
    Users,
    Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../components/ToastProvider';
import BulkDeleteControls from '../components/BulkDeleteControls';
import { UnifiedDateInput, UnifiedFilterBar, UnifiedMultiSelect, UnifiedSearchInput } from '../components/UnifiedFilters';
import {
    DashboardHero,
    DashboardPageSkeleton,
    DashboardPanel,
    DashboardStatCard,
    EmptyStatePanel,
} from '../components/analytics/DashboardPrimitives';
import { buildIncidentFilterParams, formatShortDate, getIncidentTimestamp, resolveHandlerLabel, STATUS_OPTIONS } from '../utils/analytics';
import apiClient from '../config/apiClient';
import {
    migrateIncidentStorageForUser,
    pruneIncidentStorage,
    readUserList,
    writeUserList,
} from '../utils/userStorage';
import { getRecordId } from '../utils/ids';
import { normalizeRole } from '../utils/roles';

const READ_STATUS_OPTIONS = ['All', 'Unread', 'Read'];
const formatDate = formatShortDate;

const statusPill = (status, overrides = {}) => {
    if (overrides.pending) return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-300';
    if (overrides.closureRequested) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-300';
    if (status === 'Closed') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-300';
    if (status === 'In Progress') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/30 dark:text-blue-300';
    return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-300';
};

// Icon map for category quick-scan
const categoryIcon = (category = '') => {
    const c = category.toLowerCase();
    if (c.includes('fight') || c.includes('bully') || c.includes('violence')) return AlertTriangle;
    if (c.includes('attend') || c.includes('absent')) return Clock;
    if (c.includes('academ') || c.includes('exam') || c.includes('cheat')) return BookOpen;
    return FileText;
};

const IncidentList = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { notifications } = useNotifications();
    const { addToast } = useToast();

    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
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

    const config = useMemo(() => ({ headers: {} }), []);
    const userId = getRecordId(user);
    const isSuperAdmin = normalizeRole(user?.role) === 'Super Admin';

    useEffect(() => {
        if (!userId) {
            setReadIncidents([]);
            setPriorityIncidents([]);
            return;
        }

        migrateIncidentStorageForUser(userId);
        pruneIncidentStorage(userId);
        setReadIncidents(readUserList('readIncidents', userId));
        setPriorityIncidents(readUserList('priorityIncidents', userId));
    }, [userId]);

    const allStaffOptions = useMemo(
        // Show a single unified "Administration" entry for all admin accounts;
        // teachers are listed individually by name.
        () => ['Administration', ...staffList.filter((staff) => !['Super Admin', 'Admin', 'super_admin', 'admin'].includes(staff.role)).map((staff) => staff.name)],
        [staffList]
    );

    const fetchIncidents = useCallback(async (options = { reset: false }) => {
        if (!userId) return;

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
                            .map((staff) => getRecordId(staff))
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
            const nextIncidents = Array.isArray(data) ? data : [];
            setIncidents(nextIncidents);

            const syncedReadIds = nextIncidents
                .filter((incident) => incident?.readByCurrentUser === true)
                .map((incident) => getRecordId(incident))
                .filter(Boolean);

            if (syncedReadIds.length > 0) {
                setReadIncidents((current) => {
                    const next = [...new Set([...current, ...syncedReadIds])];
                    writeUserList('readIncidents', userId, next);
                    return next;
                });
            }
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Failed to load incidents.');
        } finally {
            setLoading(false);
        }
    }, [allStaffOptions, categoryFilter, classFilter, config, dateRange.end, dateRange.start, sectionFilter, selectedStaff, staffList, statusFilter, userId]);

    const fetchFilterData = useCallback(async () => {
        if (!userId) return;
        try {
            const [staffRes, categoriesRes, classesRes, sectionsRes] = await Promise.all([
                apiClient.get('/api/auth/users', config).catch(() => ({ data: [] })),
                apiClient.get('/api/incidents/categories', config).catch(() => ({ data: [] })),
                apiClient.get('/api/incidents/classes', config).catch(() => ({ data: [] })),
                apiClient.get('/api/incidents/sections', config).catch(() => ({ data: [] })),
            ]);

            const categories = Array.isArray(categoriesRes.data)
                ? categoriesRes.data.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
                : [];
            const classes = Array.isArray(classesRes.data) ? [...classesRes.data] : [];
            const sortedClasses = classes.length > 0
                ? classes.sort((a, b) => {
                    const aNum = parseInt(a, 10);
                    const bNum = parseInt(b, 10);
                    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
                    return a.localeCompare(b);
                })
                : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
            const sections = Array.isArray(sectionsRes.data) ? sectionsRes.data : [];

            setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
            setCategoryList(categories);
            setClassList(sortedClasses);
            setSectionList(sections.length > 0 ? sections : ['A', 'B', 'C', 'D', 'E']);
        } catch {
            setStaffList([]);
            setCategoryList([]);
            setClassList(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
            setSectionList(['A', 'B', 'C', 'D', 'E']);
        }
    }, [config, userId]);

    useEffect(() => {
        fetchFilterData();
    }, [fetchFilterData]);

    useEffect(() => {
        fetchIncidents();
    }, [categoryFilter, classFilter, dateRange.end, dateRange.start, fetchIncidents, sectionFilter, selectedStaff, statusFilter, userId]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 350);

        return () => window.clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (!notifications || notifications.length === 0) return;
        
        const incidentIds = notifications
            .map((notification) => getRecordId(notification.incident))
            .filter(Boolean);

        setPriorityIncidents((current) => {
            const next = [...new Set([...current, ...incidentIds])];
            writeUserList('priorityIncidents', userId, next);
            return next;
        });
    }, [notifications, userId]);

    const markAsRead = useCallback((incidentId) => {
        setReadIncidents((current) => {
            const next = [...new Set([...current, incidentId])];
            writeUserList('readIncidents', userId, next);
            return next;
        });

        setIncidents((current) =>
            current.map((incident) =>
                getRecordId(incident) === incidentId
                    ? { ...incident, readByCurrentUser: true, readAt: incident.readAt || new Date().toISOString() }
                    : incident
            )
        );

        setPriorityIncidents((current) => {
            const next = current.filter((id) => id !== incidentId);
            writeUserList('priorityIncidents', userId, next);
            return next;
        });

        apiClient.put(`/api/incidents/${incidentId}/read`, {}).catch(() => {});
    }, [userId]);

    const isPriority = useCallback((incident) => {
        const incidentId = getRecordId(incident);
        return priorityIncidents.includes(incidentId);
    }, [priorityIncidents]);

    const isUnread = useCallback((incident) => {
        const incidentId = getRecordId(incident);
        return incident?.readByCurrentUser !== true && !readIncidents.includes(incidentId);
    }, [readIncidents]);

    const filteredIncidents = useMemo(() => {
        const query = (debouncedSearchQuery || '').toLowerCase().trim();
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
    }, [activeTab, debouncedSearchQuery, incidents, isPriority, isUnread, readStatusFilter]);

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
    }, []);

    if (loading && incidents.length === 0) {
        return (
            <div className="flex bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
                <div className="flex min-w-0 flex-1 flex-col">
                    <main className="flex-1 p-4 lg:p-6">
                        <div className="mx-auto max-w-[1600px]">
                            <DashboardPageSkeleton />
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
            <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex-1 p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-6">
                        <DashboardHero
                            eyebrow="Incident Management"
                            title="All Incidents"
                            description="View and manage incident records."
                            icon={ShieldCheck}
                            meta={(
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                        <FileText size={13} className="text-slate-400" />
                                        {summary.total} {summary.total === 1 ? 'result' : 'results'}
                                    </span>
                                    {summary.highPriority > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
                                            <Zap size={13} />
                                            {summary.highPriority} high-priority
                                        </span>
                                    ) : null}
                                    {unreadCount > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-300">
                                            <Eye size={13} />
                                            {unreadCount} unread
                                        </span>
                                    ) : null}
                                    {hasActiveFilters ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 font-medium text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-300">
                                            Filtered view
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                            <DashboardStatCard
                                title="Total"
                                value={summary.total}
                                icon={FileText}
                                tone="slate"
                                helper={hasActiveFilters ? 'Filtered results' : 'All incidents'}
                            />
                            <DashboardStatCard
                                title="Open"
                                value={summary.open}
                                icon={AlertTriangle}
                                tone="amber"
                                helper="Awaiting action"
                            />
                            <DashboardStatCard
                                title="In Progress"
                                value={summary.inProgress}
                                icon={Clock}
                                tone="blue"
                                helper="Being handled"
                            />
                            <DashboardStatCard
                                title="Closed"
                                value={summary.closed}
                                icon={CheckCircle}
                                tone="emerald"
                                helper="Resolved"
                            />
                        </div>

                        <div className="overflow-hidden rounded-[20px] border border-white/70 bg-white/90 shadow-md shadow-slate-200/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/40 sm:rounded-[26px]">
                            <div className="flex" role="tablist" aria-label="Incident view">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'all'}
                                    onClick={() => setActiveTab('all')}
                                    className={`flex flex-1 items-center justify-center gap-2.5 border-b-2 px-4 py-3.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset sm:px-6 sm:py-4 ${
                                        activeTab === 'all'
                                            ? 'border-blue-500 bg-blue-50/80 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <FileText size={15} />
                                    <span>All Incidents</span>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                                        activeTab === 'all'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                        {incidents.length}
                                    </span>
                                </button>
                                <div className="w-px self-stretch bg-slate-100 dark:bg-slate-800" aria-hidden="true" />
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'highPriority'}
                                    onClick={() => setActiveTab('highPriority')}
                                    className={`flex flex-1 items-center justify-center gap-2.5 border-b-2 px-4 py-3.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset sm:px-6 sm:py-4 ${
                                        activeTab === 'highPriority'
                                            ? 'border-amber-500 bg-amber-50/80 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Zap size={15} />
                                    <span>High Priority</span>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                                        activeTab === 'highPriority'
                                            ? 'bg-amber-500 text-white'
                                            : summary.highPriority > 0
                                                ? 'bg-red-500 text-white'
                                                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                        {summary.highPriority}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <UnifiedFilterBar
                            title="Find records"
                            hasActiveFilters={hasActiveFilters}
                            onReset={resetFilters}
                            collapsible
                            defaultCollapsed
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
                                {!['Teacher', 'teacher'].includes(user?.role) ? (
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
                                description={`Showing ${filteredIncidents.length} incident${filteredIncidents.length === 1 ? '' : 's'}${hasActiveFilters ? ' — filtered view' : ''}.`}
                                icon={FileText}
                                actions={isSuperAdmin ? (
                                    <BulkDeleteControls
                                        moduleName="incidents"
                                        filteredIds={filteredIncidents.map((incident) => getRecordId(incident)).filter(Boolean)}
                                        allCount={incidents.length}
                                        source={{ page: 'IncidentList', filteredCount: filteredIncidents.length }}
                                        addToast={addToast}
                                        onComplete={() => fetchIncidents({ reset: true })}
                                    />
                                ) : null}
                            >
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
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
                                        const CatIcon = categoryIcon(incident.category);
                                        const incidentId = getRecordId(incident);

                                        return (
                                            <article
                                                key={incidentId}
                                                aria-label={`Incident: ${incident.title || 'Untitled'}`}
                                                className={`group flex flex-col rounded-[22px] border bg-white/95 shadow-md shadow-slate-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900/95 dark:shadow-slate-950/30 ${
                                                    priority
                                                        ? 'border-amber-200 ring-1 ring-amber-200/70 dark:border-amber-500/40 dark:ring-amber-500/20'
                                                        : unread
                                                            ? 'border-blue-200 ring-1 ring-blue-200/70 dark:border-blue-500/40 dark:ring-blue-500/20'
                                                            : 'border-slate-200/80 dark:border-slate-800'
                                                }`}
                                            >
                                                {/* Card top accent stripe */}
                                                <div className={`h-1 w-full rounded-t-[22px] ${
                                                    isPendingApproval ? 'bg-red-400' :
                                                    isClosureRequest ? 'bg-emerald-400' :
                                                    incident.status === 'Closed' ? 'bg-emerald-400' :
                                                    incident.status === 'In Progress' ? 'bg-blue-400' :
                                                    isHighPriority ? 'bg-amber-400' :
                                                    'bg-orange-300'
                                                }`} aria-hidden="true" />

                                                <div className="flex flex-1 flex-col gap-0 p-4 sm:p-5">
                                                    {/* Row 1 — badges + date */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] ${statusPill(incident.status, { pending: isPendingApproval, closureRequested: isClosureRequest })}`}>
                                                                {badgeLabel}
                                                            </span>
                                                            {isHighPriority ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
                                                                    <Zap size={10} aria-hidden="true" />
                                                                    Priority
                                                                </span>
                                                            ) : null}
                                                            {unread ? (
                                                                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-300">
                                                                    New
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <time
                                                            dateTime={incidentDate}
                                                            className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400 dark:text-slate-500"
                                                        >
                                                            {formatDate(incidentDate)}
                                                        </time>
                                                    </div>

                                                    {/* Row 2 — title + admission */}
                                                    <div className="mt-3">
                                                        <h3 className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-slate-900 dark:text-slate-50">
                                                            {incident.title || 'Untitled Incident'}
                                                        </h3>
                                                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                            Adm. No: <span className="font-semibold text-slate-600 dark:text-slate-300">{incident.admissionNo || 'N/A'}</span>
                                                        </p>
                                                    </div>

                                                    {/* Row 3 — key facts grid */}
                                                    <dl className="mt-3.5 grid grid-cols-2 gap-2">
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                                                            <Users size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Student</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={studentsDisplay}>{studentsDisplay}</dd>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                                                            <UserIcon size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Assigned To</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={resolveHandlerLabel(incident)}>{resolveHandlerLabel(incident)}</dd>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                                                            <CatIcon size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Category</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={incident.category || 'Uncategorized'}>{incident.category || 'Uncategorized'}</dd>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                                                            <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Location</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={incident.location || 'Not specified'}>{incident.location || 'Not specified'}</dd>
                                                            </div>
                                                        </div>
                                                    </dl>

                                                    {/* Rejection notice */}
                                                    {incident.rejectionReason ? (
                                                        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
                                                            <span className="font-semibold">Review note: </span>{incident.rejectionReason}
                                                        </div>
                                                    ) : null}

                                                    {/* Card footer */}
                                                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5 dark:border-slate-800 mt-4">
                                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                                            <BookOpen size={11} aria-hidden="true" />
                                                            Class {incident.class || '—'} · {incident.section || '—'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            aria-label={`View details for ${incident.title || 'this incident'}`}
                                                            onClick={() => {
                                                                markAsRead(incidentId);
                                                                navigate(`/incidents/${incidentId}`);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition-all duration-150 hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-slate-700 dark:hover:bg-blue-600"
                                                        >
                                                            <Eye size={13} aria-hidden="true" />
                                                            View
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
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
