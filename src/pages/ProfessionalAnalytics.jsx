import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Pie,
    PieChart,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle,
    Clock,
    Download,
    FileText,
    List,
    ShieldCheck,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { UnifiedDateInput, UnifiedFilterBar, UnifiedMultiSelect } from '../components/UnifiedFilters';
import {
    AnalyticsDataTable,
    CategoryHeatmap,
    CHART_THEME,
    ChartTooltip,
    ChartSurface,
    CompactXAxisTick,
    CompactYAxisTick,
    DashboardHero,
    DashboardPageSkeleton,
    DashboardPanel,
    DashboardStatCard,
    DashboardWidgetPanel,
    EmptyStatePanel,
    LegendList,
    useCompactChart,
} from '../components/analytics/DashboardPrimitives';
import { DailyCreationTrendChart, IncidentStatusTrendChart } from '../components/analytics/TrendCharts';
import apiClient from '../config/apiClient';
import {
    buildDistribution,
    buildEvidenceDistribution,
    buildIncidentFilterParams,
    CHART_COLORS,
    formatShare,
    resolveHandlerLabel,
    STATUS_COLORS,
    STATUS_OPTIONS,
    buildCreationTrendSeries,
    buildStatusTrendSeries,
    formatShortDate,
    getIncidentTimestamp,
    hasUnknownEvidenceType,
    hasUnknownLocation,
    normalizeOptionList,
    toneForStatus,
    withUnknownOption,
} from '../utils/analytics';
import { downloadWorkbook } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';

const OPERATIONAL_USER_ROLES = ['Teacher', 'teacher'];

const buildClassResolution = (items) => {
    const grouped = {};

    items.forEach((incident) => {
        const className = incident.class || incident.studentDetails?.className || 'Unknown';
        if (!grouped[className]) {
            grouped[className] = { className, total: 0, open: 0, closed: 0 };
        }

        grouped[className].total += 1;
        if (incident.status === 'Open') grouped[className].open += 1;
        if (incident.status === 'Closed') grouped[className].closed += 1;
    });

    return Object.values(grouped).sort((a, b) => Number(a.className) - Number(b.className) || a.className.localeCompare(b.className));
};

const buildStaffWorkload = (items) => {
    const grouped = {};

    items.forEach((incident) => {
        const staffName = resolveHandlerLabel(incident);
        if (!grouped[staffName]) {
            grouped[staffName] = {
                name: staffName,
                open: 0,
                inProgress: 0,
                closed: 0,
                total: 0,
            };
        }

        grouped[staffName].total += 1;
        if (incident.status === 'Open') grouped[staffName].open += 1;
        if (incident.status === 'In Progress') grouped[staffName].inProgress += 1;
        if (incident.status === 'Closed') grouped[staffName].closed += 1;
    });

    return Object.values(grouped).sort((a, b) => b.total - a.total).slice(0, 8);
};

const buildCategoryHeatmap = (items) => {
    const grouped = {};

    items.forEach((incident) => {
        const category = incident.category || 'Uncategorized';
        if (!grouped[category]) {
            grouped[category] = {
                label: category,
                open: 0,
                inProgress: 0,
                closed: 0,
            };
        }

        if (incident.status === 'Open') grouped[category].open += 1;
        if (incident.status === 'In Progress') grouped[category].inProgress += 1;
        if (incident.status === 'Closed') grouped[category].closed += 1;
    });

    return Object.values(grouped).sort((a, b) => (b.open + b.inProgress + b.closed) - (a.open + a.inProgress + a.closed));
};

const ProfessionalAnalytics = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const isOperationalUser = OPERATIONAL_USER_ROLES.includes(user?.role);
    const navigate = useNavigate();
    const compactChart = useCompactChart();
    const [incidents, setIncidents] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [filters, setFilters] = useState({
        classes: [],
        sections: [],
        incidentTypes: [],
        locations: [],
        evidence: [],
        statuses: [],
    });
    const [filterOptions, setFilterOptions] = useState({
        classes: [],
        sections: [],
        incidentTypes: [],
        locations: [],
        evidence: [],
    });
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [letterStatusMap, setLetterStatusMap] = useState({});

    const config = useMemo(() => ({ headers: {} }), []);
    const compactXAxisProps = useMemo(
        () => compactChart
            ? { height: 72, interval: 0, tickMargin: 12, tick: <CompactXAxisTick maxLength={12} /> }
            : { tick: { fill: CHART_THEME.axis, fontSize: 12 } },
        [compactChart]
    );
    const compactYAxisProps = useMemo(
        () => compactChart
            ? { tick: <CompactYAxisTick maxLength={17} /> }
            : { tick: { fill: CHART_THEME.axisStrong, fontSize: 12 } },
        [compactChart]
    );
    const horizontalBarMargin = useMemo(
        () => compactChart
            ? { top: 24, right: 12, left: -12, bottom: 36 }
            : { top: 20, right: 10, left: -20, bottom: 0 },
        [compactChart]
    );

    const allStaffOptions = useMemo(
        // Single unified "Administration" entry for all admin accounts; teachers listed individually.
        () => ['Administration', ...staffList.filter((staff) => !['Super Admin', 'Admin', 'super_admin', 'admin'].includes(staff.role)).map((staff) => staff.name)],
        [staffList]
    );

    const fetchIncidents = useCallback(async (options = { reset: false }) => {
        if (!user?._id) return;

        try {
            setLoading(true);
            const allSelected = allStaffOptions.length > 0 && selectedStaff.length === allStaffOptions.length;
            const administrationSelected = selectedStaff.includes('Administration');
            const staffIds =
                !options?.reset && selectedStaff.length > 0 && !allSelected
                    ? staffList
                        .filter((staff) => !['Super Admin', 'Admin', 'super_admin', 'admin'].includes(staff.role))
                        .filter((staff) => selectedStaff.includes(staff.name))
                        .map((staff) => staff._id)
                    : [];
            const params = options?.reset
                ? new URLSearchParams()
                : buildIncidentFilterParams({
                    dateRange: { start: dateRange.start, end: dateRange.end },
                    statuses: filters.statuses,
                    classes: filters.classes,
                    sections: filters.sections,
                    types: filters.incidentTypes,
                    locations: filters.locations,
                    evidenceTypes: filters.evidence,
                    staffIds,
                    // includeAdminRole: true = fetch incidents for ALL admin-role users
                    includeAdminRole: selectedStaff.length > 0 && !allSelected && administrationSelected,
                    includeUnassigned: false,
                });

            const requestConfig = params.toString() ? { ...config, params } : config;

            const { data } = await apiClient.get('/api/incidents', requestConfig);
            setIncidents(Array.isArray(data) ? data : []);
        } catch {
            setIncidents([]);
        } finally {
            setLoading(false);
        }
    }, [allStaffOptions, config, dateRange, filters.classes, filters.evidence, filters.incidentTypes, filters.locations, filters.sections, filters.statuses, selectedStaff, staffList, user?._id]);

    const fetchFilterOptions = useCallback(async () => {
        if (!user?._id) return;

        try {
            const [studentsRes, categoriesRes, locationsRes, evidenceRes] = await Promise.all([
                apiClient.get('/api/students/filters', config),
                apiClient.get('/api/incidents/categories', config),
                apiClient.get('/api/incidents/locations', { ...config, params: { includeUnknown: true } }),
                apiClient.get('/api/evidence-types', { ...config, params: { includeUnknown: true } }),
            ]);

            setFilterOptions({
                classes: studentsRes.data?.classes || [],
                sections: studentsRes.data?.sections || [],
                incidentTypes: normalizeOptionList(categoriesRes.data),
                locations: normalizeOptionList(locationsRes.data),
                evidence: normalizeOptionList(evidenceRes.data),
            });
        } catch {
            setFilterOptions({
                classes: [],
                sections: [],
                incidentTypes: [],
                locations: [],
                evidence: [],
            });
        }
    }, [config, user?._id]);

    const fetchStaff = useCallback(async () => {
        if (!user?._id) return;

        try {
            const { data } = await apiClient.get('/api/auth/users', config);
            // Keep ALL users in staffList (role info needed for filter logic);
            // admins are excluded from the dropdown via allStaffOptions.
            setStaffList(Array.isArray(data) ? data : []);
        } catch {
            setStaffList([]);
        }
    }, [config, user?._id]);

    const fetchLetterStatusForIncidents = useCallback(async (incidentsList) => {
        if (!user?._id || !incidentsList || incidentsList.length === 0) return;

        try {
            const incidentIds = incidentsList.map((incident) => incident._id || incident.id).filter(Boolean);
            const { data } = await apiClient.post(
                '/api/issued-letters/status/batch',
                { incidentIds },
                config
            );
            setLetterStatusMap(data || {});
        } catch {
            setLetterStatusMap({});
        }
    }, [config, user?._id]);

    useEffect(() => {
        fetchIncidents();
    }, [dateRange.end, dateRange.start, fetchIncidents, filters.classes, filters.evidence, filters.incidentTypes, filters.locations, filters.sections, filters.statuses, selectedStaff, user?._id]);

    useEffect(() => {
        fetchFilterOptions();
        fetchStaff();
    }, [fetchFilterOptions, fetchStaff]);

    useEffect(() => {
        if (isOperationalUser && user?.name) {
            setSelectedStaff([user.name]);
        }
    }, [isOperationalUser, user?.name]);

    useEffect(() => {
        if (incidents.length > 0) {
            // Refetch letter status when the incident count changes, not on every array reference update.
            fetchLetterStatusForIncidents(incidents);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on incidents.length only
    }, [incidents.length, fetchLetterStatusForIncidents]);

    const filteredIncidents = useMemo(() => incidents, [incidents]);
    const locationFilterOptions = useMemo(
        () => withUnknownOption(filterOptions.locations, hasUnknownLocation(incidents) || filters.locations.includes('Unknown')),
        [filterOptions.locations, filters.locations, incidents]
    );
    const evidenceFilterOptions = useMemo(
        () => withUnknownOption(filterOptions.evidence, hasUnknownEvidenceType(incidents) || filters.evidence.includes('Unknown')),
        [filterOptions.evidence, filters.evidence, incidents]
    );

    const analytics = useMemo(() => {
        const total = filteredIncidents.length;
        const open = filteredIncidents.filter((incident) => incident.status === 'Open').length;
        const inProgress = filteredIncidents.filter((incident) => incident.status === 'In Progress').length;
        const closed = filteredIncidents.filter((incident) => incident.status === 'Closed').length;
        const lettersIssued = filteredIncidents.filter((incident) => {
            const incidentId = incident._id || incident.id;
            return letterStatusMap[incidentId]?.hasLetter;
        }).length;

        const statusData = [
            { name: 'Open', value: open, color: STATUS_COLORS.Open },
            { name: 'In Progress', value: inProgress, color: STATUS_COLORS['In Progress'] },
            { name: 'Closed', value: closed, color: STATUS_COLORS.Closed },
        ];

        return {
            total,
            open,
            inProgress,
            closed,
            lettersIssued,
            active: open + inProgress,
            unassigned: filteredIncidents.filter((incident) => !incident?.assignedHandler || ['Super Admin', 'Admin', 'super_admin', 'admin'].includes(incident?.assignedHandler?.role)).length,
            resolutionRate: total > 0 ? `${Math.round((closed / total) * 100)}%` : '0%',
            statusData,
            statusTrendData: buildStatusTrendSeries({
                items: filteredIncidents,
                dateRange,
                fallbackDays: 14,
            }),
            creationTrendData: buildCreationTrendSeries({
                items: filteredIncidents,
                dateRange,
                fallbackDays: 14,
            }),
            categoryData: buildDistribution(filteredIncidents, (incident) => incident.category || 'Uncategorized'),
            locationData: buildDistribution(filteredIncidents, (incident) => incident.location),
            evidenceData: buildEvidenceDistribution(filteredIncidents),
            classWiseData: buildClassResolution(filteredIncidents),
            staffWorkload: buildStaffWorkload(filteredIncidents),
            categoryHeatmap: buildCategoryHeatmap(filteredIncidents),
        };
    }, [dateRange, filteredIncidents, letterStatusMap]);

    const filteredIncidentDetails = useMemo(
        () =>
            [...filteredIncidents].sort((a, b) => {
                const classA = String(a.class || a.studentDetails?.className || '').toLowerCase();
                const classB = String(b.class || b.studentDetails?.className || '').toLowerCase();
                if (classA !== classB) return classA.localeCompare(classB);

                const sectionA = String(a.section || a.studentDetails?.section || '').toLowerCase();
                const sectionB = String(b.section || b.studentDetails?.section || '').toLowerCase();
                if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

                return String(a.studentDetails?.name || '').localeCompare(String(b.studentDetails?.name || ''));
            }),
        [filteredIncidents]
    );

    const hasActiveFilters = useMemo(
        () =>
            filters.classes.length > 0 ||
            filters.sections.length > 0 ||
            filters.incidentTypes.length > 0 ||
            filters.locations.length > 0 ||
            filters.evidence.length > 0 ||
            filters.statuses.length > 0 ||
            selectedStaff.length > 0 ||
            Boolean(dateRange.start) ||
            Boolean(dateRange.end),
        [dateRange.end, dateRange.start, filters, selectedStaff.length]
    );

    const resetFilters = useCallback(() => {
        setFilters({
            classes: [],
            sections: [],
            incidentTypes: [],
            locations: [],
            evidence: [],
            statuses: [],
        });
        setSelectedStaff(isOperationalUser && user?.name ? [user.name] : []);
        setDateRange({ start: '', end: '' });
    }, [isOperationalUser, user?.name]);

    const exportIncidentDetailsToExcel = useCallback(async () => {
        try {
            setIsExporting(true);

            const excelData = filteredIncidentDetails.map((incident) => {
                const incidentId = incident._id || incident.id;
                const letterInfo = letterStatusMap[incidentId] || {};

                return {
                    'Admission Number': incident.admissionNo || 'N/A',
                    'Student Name': incident.studentDetails?.name || incident.studentsInvolved?.[0] || 'N/A',
                    Class: incident.class || incident.studentDetails?.className || 'N/A',
                    Section: incident.section || incident.studentDetails?.section || 'N/A',
                    Category: incident.category || 'N/A',
                    Location: incident.location || 'N/A',
                    Evidence: (incident.evidence || []).map((entry) => entry?.evidenceType).filter(Boolean).join(', ') || 'None',
                    Reporter: incident.reportedBy?.name || 'Unknown',
                    Handler: resolveHandlerLabel(incident),
                    Status: incident.status || 'N/A',
                    Opened: formatShortDate(getIncidentTimestamp(incident)),
                    Closed: formatShortDate(incident.closedAt),
                    Letter: letterInfo.hasLetter ? 'Issued' : 'Not Issued',
                };
            });

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Incident Details');
            await withFeedback(
                addToast,
                () => downloadWorkbook(
                    XLSX,
                    wb,
                    `incident_details_${new Date().toISOString().split('T')[0]}.xlsx`,
                    { title: 'Incident details export' }
                ),
                {
                    successMessage: 'Excel exported successfully.',
                    errorMessage: 'Export failed.',
                }
            );
        } catch {
        } finally {
            setIsExporting(false);
        }
    }, [addToast, filteredIncidentDetails, letterStatusMap]);

    if (loading && incidents.length === 0) {
        return (
            <div className="flex min-h-screen bg-slate-100">
                <div className="flex min-w-0 flex-1 flex-col">
                    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                        <div className="mx-auto max-w-[1600px]">
                            <DashboardPageSkeleton />
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    const detailColumns = [
        { key: 'admissionNo', label: 'Admission No', render: (row) => <span className="font-mono text-xs text-slate-600">{row.admissionNo || 'N/A'}</span> },
        { key: 'studentName', label: 'Student', render: (row) => row.studentDetails?.name || row.studentsInvolved?.[0] || 'N/A' },
        { key: 'className', label: 'Class', render: (row) => row.class || row.studentDetails?.className || 'N/A' },
        { key: 'section', label: 'Section', render: (row) => row.section || row.studentDetails?.section || 'N/A' },
        { key: 'category', label: 'Type', render: (row) => row.category || 'N/A' },
        { key: 'location', label: 'Location', render: (row) => row.location || 'N/A' },
        {
            key: 'evidence',
            label: 'Evidence',
            render: (row) =>
                row.evidence && row.evidence.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {row.evidence.map((entry, index) => (
                            <span key={`${row._id}-e-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                                {entry.evidenceType || 'Evidence'}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-xs text-slate-400">None</span>
                ),
        },
        { key: 'reporter', label: 'Reporter', render: (row) => row.reportedBy?.name || 'Unknown' },
        { key: 'handler', label: 'Handler', render: (row) => resolveHandlerLabel(row) },
        {
            key: 'status',
            label: 'Status',
            render: (row) => (
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneForStatus(row.status)}`}>
                    {row.status}
                </span>
            ),
        },
        { key: 'opened', label: 'Opened', render: (row) => formatShortDate(getIncidentTimestamp(row)) },
        { key: 'closed', label: 'Closed', render: (row) => formatShortDate(row.closedAt) },
        {
            key: 'letter',
            label: 'Letter',
            render: (row) => {
                const incidentId = row._id || row.id;
                const issued = Boolean(letterStatusMap[incidentId]?.hasLetter);
                return (
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${issued ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {issued ? 'Issued' : 'Pending'}
                    </span>
                );
            },
        },
        { key: 'actions', label: 'Actions', render: (row) => (<button type="button" onClick={() => navigate(`/incidents/${row._id || row.id}`)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800">View</button>), },
    ];

    const statusTrendColumns = [
        { key: 'name', label: 'Period' },
        { key: 'open', label: 'Open' },
        { key: 'inProgress', label: 'In Progress' },
        { key: 'closed', label: 'Closed' },
    ];

    const creationTrendColumns = [
        { key: 'name', label: 'Period' },
        { key: 'created', label: 'New Incidents' },
    ];

    const statusTableRows = analytics.statusData.map((entry) => ({
        ...entry,
        share: formatShare(entry.value, analytics.total),
    }));

    const statusColumns = [
        { key: 'name', label: 'Status' },
        { key: 'value', label: 'Incidents' },
        { key: 'share', label: 'Share' },
    ];

    const workloadColumns = [
        { key: 'name', label: 'Staff Member' },
        { key: 'open', label: 'Open' },
        { key: 'inProgress', label: 'In Progress' },
        { key: 'closed', label: 'Closed' },
        { key: 'total', label: 'Total' },
    ];

    const categoryHeatmapColumns = [
        { key: 'label', label: 'Category' },
        { key: 'open', label: 'Open' },
        { key: 'inProgress', label: 'In Progress' },
        { key: 'closed', label: 'Closed' },
        { key: 'total', label: 'Total' },
    ];

    const categoryHeatmapRows = analytics.categoryHeatmap.map((row) => ({
        ...row,
        total: row.open + row.inProgress + row.closed,
    }));

    const categoryColumns = [
        { key: 'name', label: 'Category' },
        { key: 'count', label: 'Incidents' },
    ];

    const evidenceColumns = [
        { key: 'name', label: 'Evidence Type' },
        { key: 'count', label: 'Records' },
    ];

    const classResolutionColumns = [
        { key: 'className', label: 'Class' },
        { key: 'open', label: 'Open' },
        { key: 'closed', label: 'Closed' },
        { key: 'total', label: 'Total' },
    ];

    const classResolutionRows = analytics.classWiseData.map((row) => ({
        ...row,
        total: row.total ?? row.open + row.closed,
    }));

    const locationColumns = [
        { key: 'name', label: 'Location' },
        { key: 'count', label: 'Incidents' },
    ];

    return (
        <div className="flex min-h-screen bg-slate-100">
            <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-6">
                        <DashboardHero
                            eyebrow="Reports & trends"
                            title="School reports & summary"
                            description="View school-wide incident reports and trends."
                            icon={ShieldCheck}
                            actions={
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setActiveTab('overview')}
                                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-950' : 'bg-white/10 text-white hover:bg-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'}`}
                                    >
                                        <BarChart3 size={16} className="mr-2 inline" />
                                        Overview
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('details')}
                                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${activeTab === 'details' ? 'bg-white text-slate-900 shadow-sm dark:bg-white dark:text-slate-950' : 'bg-white/10 text-white hover:bg-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'}`}
                                    >
                                        <List size={16} className="mr-2 inline" />
                                        Case details
                                    </button>
                                </div>
                            }
                            meta={
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                        {filteredIncidents.length} filtered incident{filteredIncidents.length === 1 ? '' : 's'}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                        Resolution rate {analytics.resolutionRate}
                                    </span>
                                </div>
                            }
                        />

                        <UnifiedFilterBar
                            hasActiveFilters={hasActiveFilters}
                            onReset={resetFilters}
                            title="Search & filters"
                            collapsible
                            defaultCollapsed
                            actions={
                                <button
                                    onClick={exportIncidentDetailsToExcel}
                                    disabled={isExporting}
                                    className="btn-primary"
                                >
                                    <Download size={14} />
                                    {isExporting ? 'Exporting...' : 'Export Excel'}
                                </button>
                            }
                        >
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8">
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
                                    label="Class"
                                    options={filterOptions.classes}
                                    selected={filters.classes}
                                    onChange={(value) => setFilters((current) => ({ ...current, classes: value }))}
                                    placeholder="All Classes"
                                    searchPlaceholder="Search class..."
                                />
                                <UnifiedMultiSelect
                                    label="Section"
                                    options={filterOptions.sections}
                                    selected={filters.sections}
                                    onChange={(value) => setFilters((current) => ({ ...current, sections: value }))}
                                    placeholder="All Sections"
                                    searchPlaceholder="Search section..."
                                />
                                <UnifiedMultiSelect
                                    label="Incident Category"
                                    options={filterOptions.incidentTypes}
                                    selected={filters.incidentTypes}
                                    onChange={(value) => setFilters((current) => ({ ...current, incidentTypes: value }))}
                                    placeholder="All Categories"
                                    searchPlaceholder="Search category..."
                                />
                                <UnifiedMultiSelect
                                    label="Location"
                                    options={locationFilterOptions}
                                    selected={filters.locations}
                                    onChange={(value) => setFilters((current) => ({ ...current, locations: value }))}
                                    placeholder="All Locations"
                                    searchPlaceholder="Search location..."
                                />
                                <UnifiedMultiSelect
                                    label="Evidence Type"
                                    options={evidenceFilterOptions}
                                    selected={filters.evidence}
                                    onChange={(value) => setFilters((current) => ({ ...current, evidence: value }))}
                                    placeholder="All Evidence Types"
                                    searchPlaceholder="Search evidence..."
                                />
                                <UnifiedMultiSelect
                                    label="Status"
                                    options={STATUS_OPTIONS}
                                    selected={filters.statuses}
                                    onChange={(value) => setFilters((current) => ({ ...current, statuses: value }))}
                                    placeholder="All Status"
                                    searchPlaceholder="Search status..."
                                />
                                {!isOperationalUser ? (
                                    <UnifiedMultiSelect
                                        label="Staff Members"
                                        options={allStaffOptions}
                                        selected={selectedStaff}
                                        onChange={setSelectedStaff}
                                        placeholder="All Staff"
                                        searchPlaceholder="Search staff..."
                                    />
                                ) : (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Scope</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-900">{user?.name}</p>
                                    </div>
                                )}
                            </div>
                        </UnifiedFilterBar>

                        {activeTab === 'overview' ? (
                            <>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                                    <DashboardStatCard title="Total Incidents" value={analytics.total} icon={FileText} tone="blue" helper="All incidents in current view" />
                                    <DashboardStatCard title="Open" value={analytics.open} icon={AlertTriangle} tone="amber" helper="Requires immediate action" />
                                    <DashboardStatCard title="In Progress" value={analytics.inProgress} icon={Clock} tone="blue" helper="Being handled right now" />
                                    <DashboardStatCard title="Resolved" value={analytics.closed} icon={CheckCircle} tone="emerald" helper={`Resolution rate ${analytics.resolutionRate}`} />
                                    <DashboardStatCard title="Letters sent" value={analytics.lettersIssued} icon={TrendingUp} tone="cyan" helper="Letters completed for these incidents" />
                                </div>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                                    <DashboardWidgetPanel
                                        className="xl:col-span-7"
                                        title="Incident status over time"
                                        description="Shows how counts of open, in-progress, and closed incidents change day by day."
                                        icon={TrendingUp}
                                        chart={<IncidentStatusTrendChart data={analytics.statusTrendData} idPrefix="professional-status" />}
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'Open', color: STATUS_COLORS.Open },
                                                    { label: 'In Progress', color: STATUS_COLORS['In Progress'] },
                                                    { label: 'Closed', color: STATUS_COLORS.Closed },
                                                ]}
                                            />
                                        }
                                        tableColumns={statusTrendColumns}
                                        tableRows={analytics.statusTrendData}
                                        emptyMessage="No status trend data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-5"
                                        title="New incidents by day"
                                        description="Counts how many new incident reports appear on each calendar day."
                                        icon={AlertTriangle}
                                        chart={<DailyCreationTrendChart data={analytics.creationTrendData} />}
                                        tableColumns={creationTrendColumns}
                                        tableRows={analytics.creationTrendData}
                                        emptyMessage="No creation trend data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-5"
                                        title="Where incidents stand today"
                                        description="Open, in-progress, and closed incidents as parts of the whole."
                                        icon={BarChart3}
                                        chart={
                                            <ChartSurface height={240}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                            <PieChart>
                                                    <Pie
                                                        data={analytics.statusData}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        innerRadius={62}
                                                        outerRadius={92}
                                                        paddingAngle={4}
                                                    >
                                                        {analytics.statusData.map((entry) => (
                                                            <Cell key={entry.name} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <ChartTooltip />
                                                </PieChart>
                                            </ResponsiveContainer>

                                            </ChartSurface>
                                        }
                                        footer={
                                            <LegendList
                                                items={analytics.statusData.map((entry) => ({
                                                    label: entry.name,
                                                    value: entry.value,
                                                    color: entry.color,
                                                }))}
                                            />
                                        }
                                        tableColumns={statusColumns}
                                        tableRows={statusTableRows}
                                        emptyMessage="No status data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-7"
                                        title="Workload by staff member"
                                        description="Shows how incidents are divided among staff—for open work, ongoing follow-up, and completed cases."
                                        icon={Users}
                                        chart={
                                            analytics.staffWorkload.length === 0 ? (
                                                <EmptyStatePanel
                                                    title="No workload data"
                                                    description="Adjust the filters to reveal staff handling distribution."
                                                />
                                            ) : (
                                                <ChartSurface height={340}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                <BarChart data={analytics.staffWorkload} margin={horizontalBarMargin}>
                                                        <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                        <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                        <ChartTooltip />
                                                        <Bar dataKey="open" stackId="workload" fill={STATUS_COLORS.Open} radius={[6, 6, 0, 0]} name="Open" />
                                                        <Bar dataKey="inProgress" stackId="workload" fill={STATUS_COLORS['In Progress']} name="In Progress" />
                                                        <Bar dataKey="closed" stackId="workload" fill={STATUS_COLORS.Closed} radius={[6, 6, 0, 0]} name="Closed">
                                                            <LabelList dataKey="total" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>

                                                </ChartSurface>
                                            )
                                        }
                                        tableColumns={workloadColumns}
                                        tableRows={analytics.staffWorkload}
                                        emptyMessage="No staff workload data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-6"
                                        title="Category summary (grid view)"
                                        description="See how often each incident type appears while open, in progress, or already closed."
                                        icon={BarChart3}
                                        chart={
                                            <CategoryHeatmap
                                                rows={analytics.categoryHeatmap}
                                                columns={[
                                                    { key: 'open', label: 'Open', rgb: '249, 115, 22' },
                                                    { key: 'inProgress', label: 'In Progress', rgb: '59, 130, 246' },
                                                    { key: 'closed', label: 'Closed', rgb: '34, 197, 94' },
                                                ]}
                                            />
                                        }
                                        tableColumns={categoryHeatmapColumns}
                                        tableRows={categoryHeatmapRows}
                                        emptyMessage="No category frequency data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-6"
                                        title="Category Distribution"
                                        description="Incident types ranked by how often they appear."
                                        icon={FileText}
                                        chart={
                                            <ChartSurface height={320}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                <BarChart data={analytics.categoryData.slice(0, 8)} layout="vertical" margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
                                                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" horizontal={false} />
                                                    <XAxis type="number" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <YAxis dataKey="name" type="category" width={compactChart ? 124 : 110} axisLine={false} tickLine={false} {...compactYAxisProps} />
                                                    <ChartTooltip />
                                                    <Bar dataKey="count" fill={CHART_COLORS.category} radius={[0, 8, 8, 0]} name="Incidents">
                                                        <LabelList dataKey="count" position="right" fill={CHART_THEME.label} fontSize={12} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>

                                            </ChartSurface>
                                        }
                                        tableColumns={categoryColumns}
                                        tableRows={analytics.categoryData}
                                        emptyMessage="No category distribution data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-6"
                                        title="Evidence Distribution"
                                        description="Evidence capture mix for the current dataset."
                                        icon={ShieldCheck}
                                        chart={
                                            analytics.evidenceData.length === 0 ? (
                                                <EmptyStatePanel title="No evidence data" description="No evidence records are available for the current filters." />
                                            ) : (
                                                <ChartSurface height={260}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                    <PieChart>
                                                        <Pie
                                                            data={analytics.evidenceData.slice(0, 6)}
                                                            dataKey="count"
                                                            nameKey="name"
                                                            innerRadius={54}
                                                            outerRadius={88}
                                                            paddingAngle={4}
                                                        >
                                                            {analytics.evidenceData.slice(0, 6).map((entry, index) => (
                                                                <Cell
                                                                    key={entry.name}
                                                                    fill={[CHART_COLORS.evidence, STATUS_COLORS['In Progress'], STATUS_COLORS.Closed, STATUS_COLORS.Open, CHART_COLORS.category, CHART_COLORS.neutralPrimary][index % 6]}
                                                                />
                                                            ))}
                                                        </Pie>
                                                        <ChartTooltip />
                                                    </PieChart>
                                                </ResponsiveContainer>

                                                </ChartSurface>
                                            )
                                        }
                                        footer={
                                            analytics.evidenceData.length > 0 ? (
                                                <LegendList
                                                    items={analytics.evidenceData.slice(0, 6).map((entry, index) => ({
                                                        label: entry.name,
                                                        value: entry.count,
                                                        color: [CHART_COLORS.evidence, STATUS_COLORS['In Progress'], STATUS_COLORS.Closed, STATUS_COLORS.Open, CHART_COLORS.category, CHART_COLORS.neutralPrimary][index % 6],
                                                    }))}
                                                />
                                            ) : null
                                        }
                                        tableColumns={evidenceColumns}
                                        tableRows={analytics.evidenceData}
                                        emptyMessage="No evidence data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-6"
                                        title="Class Resolution Snapshot"
                                        description="Open versus closed cases by class for fast intervention targeting."
                                        icon={TrendingUp}
                                        chart={
                                            <ChartSurface height={320}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                <BarChart data={analytics.classWiseData} margin={horizontalBarMargin}>
                                                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="className" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <ChartTooltip />
                                                    <Bar dataKey="open" fill={STATUS_COLORS.Open} radius={[6, 6, 0, 0]} name="Open">
                                                        <LabelList dataKey="open" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                    </Bar>
                                                    <Bar dataKey="closed" fill={STATUS_COLORS.Closed} radius={[6, 6, 0, 0]} name="Closed">
                                                        <LabelList dataKey="closed" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>

                                            </ChartSurface>
                                        }
                                        tableColumns={classResolutionColumns}
                                        tableRows={classResolutionRows}
                                        emptyMessage="No class resolution data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-12"
                                        title="Location Distribution"
                                        description="Most active locations in the filtered incident set."
                                        icon={ShieldCheck}
                                        chart={
                                            <ChartSurface height={320}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                <BarChart data={analytics.locationData.slice(0, 8)} margin={horizontalBarMargin}>
                                                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <ChartTooltip />
                                                    <Bar dataKey="count" fill={CHART_COLORS.location} radius={[6, 6, 0, 0]} name="Incidents">
                                                        <LabelList dataKey="count" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>

                                            </ChartSurface>
                                        }
                                        tableColumns={locationColumns}
                                        tableRows={analytics.locationData}
                                        emptyMessage="No location data is available for the current filters."
                                    />
                                </div>
                            </>
                        ) : (
                            <DashboardPanel
                                title="Single incident breakdown"
                                description="Sortable, exportable detail view of every incident included in the current analytics scope."
                                icon={List}
                            >
                                <AnalyticsDataTable
                                    columns={detailColumns}
                                    rows={filteredIncidentDetails}
                                    emptyMessage="No incidents found for the current filter set."
                                />
                            </DashboardPanel>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ProfessionalAnalytics;
