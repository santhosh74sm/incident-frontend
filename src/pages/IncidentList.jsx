import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BookOpen,
    Calendar,
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
import { buildAcademicYearOptions, buildIncidentFilterParams, formatShortDate, getIncidentTimestamp, resolveHandlerLabel, STATUS_OPTIONS, formatDisplayValue, resolveUserLabel, getFilteredSections } from '../utils/analytics';
import apiClient from '../config/apiClient';
import {
    migrateIncidentStorageForUser,
    pruneIncidentStorage,
    readUserList,
    writeUserList,
} from '../utils/userStorage';
import { getRecordId } from '../utils/ids';
import { isAdminRole, isSuperAdminRole } from '../utils/roles';

const READ_STATUS_OPTIONS = ['All', 'Unread', 'Read'];
const formatDate = formatShortDate;

const statusPill = (status, overrides = {}) => {
    if (overrides.closureRequested) return 'border-emerald-200 bg-emerald-50 text-emerald-700 ';
    if (status === 'Closed') return 'border-emerald-200 bg-emerald-50 text-emerald-700 ';
    return 'border-orange-200 bg-orange-50 text-orange-700 ';
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
    const [classSectionMap, setClassSectionMap] = useState({});

    const filteredSections = useMemo(() => {
        return getFilteredSections(classFilter, sectionList, classSectionMap);
    }, [classFilter, sectionList, classSectionMap]);

    useEffect(() => {
        if (sectionFilter.length > 0) {
            const nextSections = sectionFilter.filter((sec) => filteredSections.includes(sec));
            if (nextSections.length !== sectionFilter.length) {
                setSectionFilter(nextSections);
            }
        }
    }, [filteredSections, sectionFilter]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [academicYear, setAcademicYear] = useState('');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const [academicYears, setAcademicYears] = useState([]);
    const [readIncidents, setReadIncidents] = useState([]);
    const [priorityIncidents, setPriorityIncidents] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [readStatusFilter, setReadStatusFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [serverSummary, setServerSummary] = useState({ total: 0, pending: 0, closed: 0, highPriority: 0, unread: 0 });
    const pageSize = 18;
    const incidentRequestRef = useRef({ controller: null, id: 0 });
    const filterMetadataRef = useRef({ userId: '', data: null });
    const hasLoadedIncidentsRef = useRef(false);

    const config = useMemo(() => ({ headers: {} }), []);
    const userId = getRecordId(user);
    const isSuperAdmin = isSuperAdminRole(user?.role);

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

    const allStaffOptions = useMemo(() => {
        return staffList.map((staff) => resolveUserLabel(staff));
    }, [staffList]);
    const academicYearOptions = useMemo(
        () => buildAcademicYearOptions(academicYears, currentAcademicYear),
        [academicYears, currentAcademicYear]
    );

    const fetchIncidents = useCallback(async (options = { reset: false }) => {
        if (!userId) return;
        if (!academicYear) return;
        incidentRequestRef.current.controller?.abort();
        const controller = new AbortController();
        const requestId = incidentRequestRef.current.id + 1;
        incidentRequestRef.current = { controller, id: requestId };
        const isCurrentRequest = () => incidentRequestRef.current.id === requestId;

        try {
            setLoading(true);
            setError(null);
            const requestConfig = { ...config, params: new URLSearchParams(), signal: controller.signal };

            if (!options?.reset) {
                const allSelected = allStaffOptions.length > 0 && selectedStaff.length === allStaffOptions.length;
                const selectedStaffIds = [];
                if (selectedStaff.length > 0 && !allSelected) {
                    selectedStaff.forEach((label) => {
                        const matchedStaff = staffList.find((s) => resolveUserLabel(s) === label);
                        if (matchedStaff) {
                            selectedStaffIds.push(getRecordId(matchedStaff));
                        }
                    });
                }

                const params = buildIncidentFilterParams({
                    dateRange: { start: dateRange.start, end: dateRange.end },
                    statuses: statusFilter,
                    classes: classFilter,
                    sections: sectionFilter,
                    types: categoryFilter,
                    staffIds: selectedStaffIds,
                    includeAdminRole: false,
                    includeUnassigned: false,
                });

                requestConfig.params = params;
                if (academicYear) {
                    requestConfig.params = requestConfig.params || new URLSearchParams();
                    requestConfig.params.set('academicYear', academicYear);
                }
            }

            requestConfig.params.set('page', String(page));
            requestConfig.params.set('limit', String(pageSize));
            if (!options?.reset && debouncedSearchQuery) requestConfig.params.set('search', debouncedSearchQuery);
            if (!options?.reset && activeTab === 'highPriority') requestConfig.params.set('highPriority', 'true');
            if (!options?.reset && readStatusFilter !== 'All') requestConfig.params.set('readStatus', readStatusFilter.toLowerCase());

            const listParams = requestConfig.params;
            const summaryParams = new URLSearchParams(listParams);
            summaryParams.delete('page');
            summaryParams.delete('limit');
            const [{ data }, { data: summaryData }] = await Promise.all([
                apiClient.get('/api/incidents', requestConfig),
                apiClient.get('/api/incidents/summary', { ...config, params: summaryParams, signal: controller.signal }),
            ]);
            if (!isCurrentRequest()) return;
            const nextIncidents = Array.isArray(data?.data) ? data.data : [];
            setIncidents(nextIncidents);
            setPagination(data?.pagination || { page: 1, total: nextIncidents.length, totalPages: 1 });
            setServerSummary(summaryData || { total: 0, pending: 0, closed: 0, highPriority: 0, unread: 0 });

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
            if (['ERR_CANCELED', 'CanceledError'].includes(requestError?.code) || requestError?.name === 'CanceledError') return;
            if (!isCurrentRequest()) return;
            setError(requestError.response?.data?.message || 'Failed to load incidents.');
        } finally {
            if (isCurrentRequest()) {
                hasLoadedIncidentsRef.current = true;
                setLoading(false);
            }
        }
    }, [academicYear, activeTab, allStaffOptions, categoryFilter, classFilter, config, dateRange.end, dateRange.start, debouncedSearchQuery, page, readStatusFilter, sectionFilter, selectedStaff, staffList, statusFilter, userId]);

    useEffect(() => () => {
        incidentRequestRef.current.controller?.abort();
    }, []);

    const fetchFilterData = useCallback(async () => {
        if (!userId) return;
        try {
            const studentFilterConfig = academicYear ? { ...config, params: { academicYear } } : config;
            let metadata = filterMetadataRef.current;
            if (metadata.userId !== userId || !metadata.data) {
                const [staffRes, categoriesRes, yearRes] = await Promise.all([
                    apiClient.get('/api/auth/users', config).catch(() => ({ data: [] })),
                    apiClient.get('/api/incidents/categories', config).catch(() => ({ data: [] })),
                    apiClient.get('/api/auth/academic-years', config).catch(() => ({ data: {} })),
                ]);
                metadata = {
                    userId,
                    data: { staffRes, categoriesRes, yearRes },
                };
                filterMetadataRef.current = metadata;
            }

            const studentsRes = await apiClient.get('/api/students/filters', studentFilterConfig).catch(() => ({ data: {} }));
            const { staffRes, categoriesRes, yearRes } = metadata.data;

            const categories = Array.isArray(categoriesRes.data)
                ? categoriesRes.data.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
                : [];
            const classes = Array.isArray(studentsRes.data?.classes) ? [...studentsRes.data.classes] : [];
            const sortedClasses = classes.length > 0
                ? classes.sort((a, b) => {
                    const aNum = parseInt(a, 10);
                    const bNum = parseInt(b, 10);
                    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
                    return a.localeCompare(b);
                })
                : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
            const sections = Array.isArray(studentsRes.data?.sections) ? studentsRes.data.sections : [];
            const classSecMap = studentsRes.data?.classSectionMap || {};

            setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
            setCategoryList(categories);
            setClassList(sortedClasses);
            setSectionList(sections.length > 0 ? sections : ['A', 'B', 'C', 'D', 'E']);
            setClassSectionMap(classSecMap);
            setAcademicYears(yearRes.data?.academicYears || []);
            setCurrentAcademicYear(yearRes.data?.currentAcademicYear || '');
            setAcademicYear((current) => current || yearRes.data?.currentAcademicYear || yearRes.data?.academicYears?.[yearRes.data.academicYears.length - 1] || '');
        } catch {
            setStaffList([]);
            setCategoryList([]);
            setClassList(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
            setSectionList(['A', 'B', 'C', 'D', 'E']);
            setClassSectionMap({});
        }
    }, [config, userId, academicYear]);

    useEffect(() => {
        fetchFilterData();
    }, [fetchFilterData]);

    useEffect(() => {
        fetchIncidents();
    }, [fetchIncidents]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 350);

        return () => window.clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        setPage(1);
    }, [academicYear, activeTab, categoryFilter, classFilter, dateRange.end, dateRange.start, debouncedSearchQuery, readStatusFilter, sectionFilter, selectedStaff, statusFilter]);

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
        return incidents;
    }, [incidents]);

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
        || academicYear !== currentAcademicYear
    );

    const unreadCount = serverSummary.unread || 0;
    const summary = serverSummary;

    const resetFilters = useCallback(() => {
        setStatusFilter([]);
        setSelectedStaff([]);
        setCategoryFilter([]);
        setClassFilter([]);
        setSectionFilter([]);
        setSearchQuery('');
        setDateRange({ start: '', end: '' });
        setAcademicYear(currentAcademicYear);
        setActiveTab('all');
        setReadStatusFilter('All');
    }, [currentAcademicYear]);

    if (loading && !hasLoadedIncidentsRef.current) {
        return (
            <div className="flex bg-[#f6f8fc] text-slate-800 ">
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
        <div className="flex bg-[#f6f8fc] text-slate-800 ">
            <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex-1 p-4 lg:p-7">
                    <div className="mx-auto max-w-[1600px] space-y-5">
                        <DashboardHero
                            eyebrow="Incident Management"
                            title="All Incidents"
                            description="View and manage incident records."
                            icon={ShieldCheck}
                            meta={(
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700 ">
                                        <FileText size={13} className="text-slate-400" />
                                        {summary.total} {summary.total === 1 ? 'result' : 'results'}
                                    </span>
                                    {summary.highPriority > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-medium text-amber-800 ">
                                            <Zap size={13} />
                                            {summary.highPriority} high-priority
                                        </span>
                                    ) : null}
                                    {unreadCount > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-800 ">
                                            <Eye size={13} />
                                            {unreadCount} unread
                                        </span>
                                    ) : null}
                                    {hasActiveFilters ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 font-medium text-violet-800 ">
                                            Filtered view
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <DashboardStatCard
                                title="Total"
                                value={summary.total}
                                icon={FileText}
                                tone="slate"
                                helper={hasActiveFilters ? 'Filtered results' : 'All incidents'}
                            />
                            <DashboardStatCard
                                title="Pending"
                                value={summary.pending || summary.open}
                                icon={AlertTriangle}
                                tone="amber"
                                helper="Awaiting action"
                            />
                            <DashboardStatCard
                                title="Closed"
                                value={summary.closed}
                                icon={CheckCircle}
                                tone="emerald"
                                helper="Resolved"
                            />
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ">
                            <div className="flex" role="tablist" aria-label="Incident view">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'all'}
                                    onClick={() => setActiveTab('all')}
                                    className={`flex flex-1 items-center justify-center gap-2.5 border-b-2 px-4 py-3.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset sm:px-6 sm:py-4 ${
                                        activeTab === 'all'
                                            ? 'border-blue-600 bg-blue-50/80 text-blue-700 '
                                            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 '
                                    }`}
                                >
                                    <FileText size={15} />
                                    <span>All Incidents</span>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                                        activeTab === 'all'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-slate-100 text-slate-500 '
                                    }`}>
                                        {pagination.total}
                                    </span>
                                </button>
                                <div className="w-px self-stretch bg-slate-100 " aria-hidden="true" />
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === 'highPriority'}
                                    onClick={() => setActiveTab('highPriority')}
                                    className={`flex flex-1 items-center justify-center gap-2.5 border-b-2 px-4 py-3.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset sm:px-6 sm:py-4 ${
                                        activeTab === 'highPriority'
                                            ? 'border-blue-600 bg-blue-50/80 text-blue-700 '
                                            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700 '
                                    }`}
                                >
                                    <Zap size={15} />
                                    <span>High Priority</span>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                                        activeTab === 'highPriority'
                                            ? 'bg-amber-500 text-white'
                                            : summary.highPriority > 0
                                                ? 'bg-red-500 text-white'
                                                : 'bg-slate-200 text-slate-600 '
                                    }`}>
                                        {summary.highPriority}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <UnifiedFilterBar
                            title="Filters"
                            hasActiveFilters={hasActiveFilters}
                            onReset={resetFilters}
                            collapsible
                            actions={loading ? (
                                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 ">
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                                    Updating…
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
                                    placeholder="All statuses"
                                    searchPlaceholder="Search statuses…"
                                />
                            </div>

                            <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                                <label className="min-w-0">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Academic Year</span>
                                    <select
                                        value={academicYear}
                                        onChange={(event) => setAcademicYear(event.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 "
                                    >
                                        {academicYearOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <UnifiedMultiSelect
                                    label="Staff Members"
                                    options={allStaffOptions}
                                    selected={selectedStaff}
                                    onChange={setSelectedStaff}
                                    placeholder="All staff"
                                    searchPlaceholder="Search staff…"
                                />
                                <UnifiedMultiSelect
                                    label="Incident Category"
                                    options={categoryList}
                                    selected={categoryFilter}
                                    onChange={setCategoryFilter}
                                    placeholder="All categories"
                                    searchPlaceholder="Search categories…"
                                />
                                <UnifiedMultiSelect
                                    label="Class"
                                    options={classList}
                                    selected={classFilter}
                                    onChange={setClassFilter}
                                    placeholder="All classes"
                                    searchPlaceholder="Search classes…"
                                />
                                <UnifiedMultiSelect
                                    label="Section"
                                    options={filteredSections}
                                    selected={sectionFilter}
                                    onChange={setSectionFilter}
                                    placeholder="All sections"
                                    searchPlaceholder="Search sections…"
                                />
                                <div className="min-w-0">
                                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">Read Status</p>
                                    <div className="flex min-h-[44px] flex-wrap overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ">
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
                                                        : 'text-slate-600 hover:bg-slate-50 '
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
                                    Try Again
                                </button>
                            </DashboardPanel>
                        ) : null}

                        {!error && filteredIncidents.length === 0 ? (
                            <EmptyStatePanel
                                title="No incidents found."
                                description={summary.total === 0 ? 'There are no incidents in the system yet.' : 'No incidents match your current filters.'}
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
                                        allCount={summary.total}
                                        source={{ page: 'IncidentList', filteredCount: filteredIncidents.length }}
                                        addToast={addToast}
                                        onComplete={() => fetchIncidents()}
                                    />
                                ) : null}
                            >
                                <div className="hidden overflow-hidden rounded-lg border border-slate-200 md:block ">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1040px] text-left text-sm">
                                            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 ">
                                                <tr>
                                                    <th className="px-4 py-3">#</th>
                                                    <th className="px-4 py-3">Incident</th>
                                                    <th className="px-4 py-3">Student</th>
                                                    <th className="px-4 py-3">Category</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3">Assigned To</th>
                                                    <th className="px-4 py-3">Opened On</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white ">
                                                {filteredIncidents.map((incident, index) => {
                                                    const isClosureRequest = isAdminRole(user?.role) && incident.closureRequested && incident.status !== 'Closed';
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
                                                    const badgeLabel = isClosureRequest ? 'Seal ready' : incident.status;
                                                    const incidentId = getRecordId(incident);
                                                    const rowNumber = ((pagination.page || 1) - 1) * pageSize + index + 1;

                                                    return (
                                                        <tr
                                                            key={incidentId}
                                                            className={`transition hover:bg-slate-50/80 ${
                                                                priority ? 'bg-amber-50/20 ' : unread ? 'bg-blue-50/20 ' : ''
                                                            }`}
                                                        >
                                                            <td className="px-4 py-3.5 text-xs font-semibold text-slate-500">{rowNumber}</td>
                                                            <td className="px-4 py-3.5">
                                                                <div className="flex items-start gap-2">
                                                                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                                                        isClosureRequest || incident.status === 'Closed' ? 'bg-emerald-500' :
                                                                        isHighPriority ? 'bg-amber-500' :
                                                                        'bg-orange-500'
                                                                    }`} />
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold leading-tight text-slate-950 ">{incident.title || 'Untitled Incident'}</p>
                                                                        <p className="mt-1 text-xs text-slate-500">Admission No: {incident.admissionNo || 'N/A'}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-slate-700 ">{studentsDisplay}</p>
                                                                    <p className="mt-1 text-xs text-slate-500">Class {incident.class || '-'} - {incident.section || '-'}</p>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                                    (incident.category || '').toLowerCase().includes('late') ? 'border-violet-200 bg-violet-50 text-violet-700 ' :
                                                                    (incident.category || '').toLowerCase().includes('absent') ? 'border-amber-200 bg-amber-50 text-amber-700 ' :
                                                                    'border-red-200 bg-red-50 text-red-700 '
                                                                }`}>
                                                                    {formatDisplayValue(incident.category || 'Uncategorized')}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPill(incident.status, { closureRequested: isClosureRequest })}`}>
                                                                    {formatDisplayValue(badgeLabel)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <div className="flex items-center gap-2">
                                                                    {(() => {
                                                                        const handlerName = resolveHandlerLabel(incident);
                                                                        const letter = handlerName && handlerName !== 'Unassigned' && handlerName !== 'Unknown User' ? handlerName.charAt(0).toUpperCase() : 'U';
                                                                        return (
                                                                            <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                                                                                {letter}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                    <span className="font-medium text-slate-700 ">{resolveHandlerLabel(incident)}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-sm tabular-nums text-slate-600 ">
                                                                {formatDate(incidentDate)}
                                                            </td>
                                                            <td className="px-4 py-3.5">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        aria-label={`View details for ${incident.title || 'this incident'}`}
                                                                        onClick={() => {
                                                                            markAsRead(incidentId);
                                                                            navigate(`/incidents/${incidentId}`);
                                                                        }}
                                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 "
                                                                    >
                                                                        <Eye size={15} aria-hidden="true" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        aria-label={`More actions for ${incident.title || 'this incident'}`}
                                                                        onClick={() => {
                                                                            markAsRead(incidentId);
                                                                            navigate(`/incidents/${incidentId}`);
                                                                        }}
                                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 "
                                                                    >
                                                                        ...
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2.5 md:hidden">
                                    {filteredIncidents.map((incident) => {
                                        const isClosureRequest = isAdminRole(user?.role) && incident.closureRequested && incident.status !== 'Closed';
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
                                        const badgeLabel = isClosureRequest ? 'Seal ready' : incident.status;
                                        const CatIcon = categoryIcon(incident.category);
                                        const incidentId = getRecordId(incident);

                                        return (
                                            <article
                                                key={incidentId}
                                                aria-label={`Incident: ${incident.title || 'Untitled'}`}
                                                className={`incident-list-mobile-card group flex flex-col rounded-lg border bg-white shadow-sm transition-all duration-200 ${
                                                    priority
                                                        ? 'border-amber-200 ring-1 ring-amber-200/70 '
                                                        : unread
                                                            ? 'border-blue-200 ring-1 ring-blue-200/70 '
                                                            : 'border-slate-200/80 '
                                                }`}
                                            >
                                                {/* Card top accent stripe */}
                                                <div className={`h-1 w-full rounded-t-lg ${
                                                    isClosureRequest ? 'bg-emerald-400' :
                                                    incident.status === 'Closed' ? 'bg-emerald-400' :
                                                    isHighPriority ? 'bg-amber-400' :
                                                    'bg-orange-300'
                                                }`} aria-hidden="true" />

                                                <div className="flex flex-1 flex-col gap-0 p-3">
                                                    {/* Row 1 — badges + date */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] ${statusPill(incident.status, { closureRequested: isClosureRequest })}`}>
                                                                {formatDisplayValue(badgeLabel)}
                                                            </span>
                                                            {isHighPriority ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800 ">
                                                                    <Zap size={10} aria-hidden="true" />
                                                                    Priority
                                                                </span>
                                                            ) : null}
                                                            {unread ? (
                                                                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700 ">
                                                                    New
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <time
                                                            dateTime={incidentDate}
                                                            className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400 "
                                                        >
                                                            {formatDate(incidentDate)}
                                                        </time>
                                                    </div>

                                                    {/* Row 2 — title + admission */}
                                                    <div className="mt-2">
                                                        <h3 className="line-clamp-1 text-sm font-bold leading-snug tracking-tight text-slate-900 ">
                                                            {incident.title || 'Untitled Incident'}
                                                        </h3>
                                                        <p className="mt-1 text-xs text-slate-400 ">
                                                            Admission Number: <span className="font-semibold text-slate-600 ">{incident.admissionNo || 'N/A'}</span>
                                                        </p>
                                                    </div>

                                                    {/* Row 3 — key facts grid */}
                                                    <dl className="incident-list-mobile-facts mt-2.5 grid grid-cols-2 gap-2">
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ">
                                                            <Users size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ">Student</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 " title={studentsDisplay}>{studentsDisplay}</dd>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ">
                                                            <UserIcon size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ">Assigned To</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 " title={resolveHandlerLabel(incident)}>{resolveHandlerLabel(incident)}</dd>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ">
                                                            <CatIcon size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ">Category</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 " title={incident.category || 'Uncategorized'}>{formatDisplayValue(incident.category || 'Uncategorized')}</dd>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ">
                                                            <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ">Location</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 " title={incident.location || 'Not specified'}>{formatDisplayValue(incident.location || 'Not specified')}</dd>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ">
                                                            <Calendar size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                                                            <div className="min-w-0">
                                                                <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ">Academic Year</dt>
                                                                <dd className="mt-0.5 truncate text-xs font-semibold text-slate-800 ">{incident.academicYear || 'N/A'}</dd>
                                                            </div>
                                                        </div>
                                                    </dl>

                                                    {/* Rejection notice */}
                                                    {incident.rejectionReason ? (
                                                        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 ">
                                                            <span className="font-semibold">Review Note: </span>{incident.rejectionReason}
                                                        </div>
                                                    ) : null}

                                                    {/* Card footer */}
                                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 ">
                                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500 ">
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
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 "
                                                        >
                                                            <Eye size={13} aria-hidden="true" />
                                                            View Details
                                                        </button>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                                    <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} records</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                                            disabled={pagination.page <= 1 || loading}
                                            className="rounded-xl border border-slate-200 px-3 py-2 font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 "
                                        >
                                            Previous
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                                            disabled={pagination.page >= pagination.totalPages || loading}
                                            className="rounded-xl border border-slate-200 px-3 py-2 font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 "
                                        >
                                            Next
                                        </button>
                                    </div>
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
