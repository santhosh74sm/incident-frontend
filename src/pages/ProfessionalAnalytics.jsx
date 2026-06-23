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
    Tooltip,
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
    buildIncidentFilterParams,
    CHART_COLORS,
    formatShare,
    resolveHandlerLabel,
    STATUS_COLORS,
    STATUS_OPTIONS,
    buildCreationTrendSeries,
    buildAcademicYearOptions,
    buildStatusTrendSeries,
    buildTrendSeriesFromBuckets,
    formatProgressLogForDisplay,
    formatProgressLogForExport,
    formatShortDate,
    getIncidentTimestamp,
    normalizeOptionList,
    resolveIncidentPriorityForExport,
    toneForStatus,
    withUnknownOption,
    formatDisplayValue,
} from '../utils/analytics';
import { downloadWorkbook } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';
import { isAdminRole, isTeacherRole } from '../utils/roles';

const slugifyExportPart = (value, fallback = 'all') => {
    const clean = String(value || fallback).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    return clean || fallback;
};

const AcademicYearStatusTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload || {};

    return (
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                {row.academicYear || label || 'Academic Year'}
            </p>
            <div className="space-y-1.5">
                {[
                    { label: 'Total Incidents', value: row.total, color: CHART_COLORS.neutralPrimary },
                    { label: 'Open', value: row.open, color: STATUS_COLORS.Open },
                    { label: 'In progress', value: row.inProgress, color: STATUS_COLORS['In Progress'] },
                    { label: 'Closed', value: row.closed, color: STATUS_COLORS.Closed },
                ].map((entry) => (
                    <div key={entry.label} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-600 dark:text-slate-300">{entry.label}</span>
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {Number(entry.value || 0).toLocaleString('en-US')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ProfessionalAnalytics = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const isOperationalUser = isTeacherRole(user?.role);
    const navigate = useNavigate();
    const compactChart = useCompactChart();
    const [incidents, setIncidents] = useState([]);
    const [serverAnalytics, setServerAnalytics] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyticsError, setAnalyticsError] = useState('');
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
    const [academicYear, setAcademicYear] = useState('');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const [academicYears, setAcademicYears] = useState([]);
    const [letterStatusMap, setLetterStatusMap] = useState({});
    const [detailPage, setDetailPage] = useState(1);
    const [detailPagination, setDetailPagination] = useState(null);

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
    const academicYearOptions = useMemo(
        () => buildAcademicYearOptions(academicYears, currentAcademicYear),
        [academicYears, currentAcademicYear]
    );

    const allStaffOptions = useMemo(
        // Single unified "Administration" entry for all admin accounts; teachers listed individually.
        () => ['Admin', ...staffList.filter((staff) => !isAdminRole(staff.role)).map((staff) => staff.name)],
        [staffList]
    );

    const buildRequestParams = useCallback(() => {
        const allSelected = allStaffOptions.length > 0 && selectedStaff.length === allStaffOptions.length;
        const administrationSelected = selectedStaff.includes('Admin');
        const staffIds = selectedStaff.length > 0 && !allSelected
            ? staffList
                .filter((staff) => !isAdminRole(staff.role))
                .filter((staff) => selectedStaff.includes(staff.name))
                .map((staff) => staff._id)
            : [];
        const params = buildIncidentFilterParams({
            dateRange: { start: dateRange.start, end: dateRange.end },
            statuses: filters.statuses,
            classes: filters.classes,
            sections: filters.sections,
            types: filters.incidentTypes,
            locations: filters.locations,
            evidenceTypes: filters.evidence,
            staffIds,
            includeAdminRole: selectedStaff.length > 0 && !allSelected && administrationSelected,
            includeUnassigned: false,
        });
        if (academicYear) params.set('academicYear', academicYear);
        params.set('timezoneOffsetMinutes', String(new Date().getTimezoneOffset()));
        return params;
    }, [academicYear, allStaffOptions.length, dateRange.end, dateRange.start, filters.classes, filters.evidence, filters.incidentTypes, filters.locations, filters.sections, filters.statuses, selectedStaff, staffList]);

    const fetchAnalytics = useCallback(async () => {
        if (!user?._id || !academicYear) return;
        try {
            setLoading(true);
            setAnalyticsError('');
            const params = buildRequestParams();
            const { data } = await apiClient.get('/api/incidents/analytics', { ...config, params });
            const requiredArrays = ['statusData', 'categoryData', 'locationData', 'evidenceData', 'classWiseData', 'staffWorkload', 'categoryHeatmap', 'academicYearData', 'trendBuckets'];
            if (
                !data
                || typeof data !== 'object'
                || !['total', 'open', 'inProgress', 'closed', 'lettersIssued'].every((key) => Number.isFinite(Number(data[key])))
                || !requiredArrays.every((key) => Array.isArray(data[key]))
            ) {
                throw new Error('Analytics endpoint returned an invalid response.');
            }
            setServerAnalytics(data || null);
            setIncidents([]);
            setLetterStatusMap({});
            setDetailPage(1);
            setDetailPagination(null);
        } catch (error) {
            setServerAnalytics(null);
            setIncidents([]);
            setLetterStatusMap({});
            setAnalyticsError(error.response?.data?.message || error.message || 'Analytics data could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, [academicYear, buildRequestParams, config, user?._id]);

    const fetchAnalyticsDetails = useCallback(async ({ updateState = true, page = detailPage, limit = 100 } = {}) => {
        if (!user?._id || !academicYear) return { data: [], letterStatusMap: {} };
        const params = buildRequestParams();
        params.set('page', String(page));
        params.set('limit', String(limit));
        const { data } = await apiClient.get('/api/incidents/analytics/details', { ...config, params });
        const payload = {
            data: Array.isArray(data?.data) ? data.data : [],
            letterStatusMap: data?.letterStatusMap || {},
            pagination: data?.pagination || null,
        };
        if (updateState) {
            setIncidents(payload.data);
            setLetterStatusMap(payload.letterStatusMap);
            setDetailPagination(payload.pagination);
        }
        return payload;
    }, [academicYear, buildRequestParams, config, detailPage, user?._id]);

    const fetchFilterOptions = useCallback(async () => {
        if (!user?._id) return;

        try {
            const studentFilterConfig = academicYear ? { ...config, params: { academicYear } } : config;
            const [studentsRes, categoriesRes, locationsRes, evidenceRes, yearsRes] = await Promise.all([
                apiClient.get('/api/students/filters', studentFilterConfig),
                apiClient.get('/api/incidents/categories', config),
                apiClient.get('/api/incidents/locations', { ...config, params: { includeUnknown: true } }),
                apiClient.get('/api/evidence-types', { ...config, params: { includeUnknown: true } }),
                apiClient.get('/api/auth/academic-years', config),
            ]);

            const nextYears = yearsRes.data?.academicYears || [];
            setAcademicYears(nextYears);
            setCurrentAcademicYear(yearsRes.data?.currentAcademicYear || '');
            setAcademicYear((current) => current || yearsRes.data?.currentAcademicYear || nextYears[nextYears.length - 1] || '');
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
    }, [academicYear, config, user?._id]);

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

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

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
        if (activeTab !== 'details' || !serverAnalytics) return;
        fetchAnalyticsDetails({ page: detailPage }).catch(() => {
            setIncidents([]);
            setLetterStatusMap({});
        });
    }, [activeTab, detailPage, fetchAnalyticsDetails, serverAnalytics]);

    const filteredIncidents = useMemo(() => incidents, [incidents]);
    const locationFilterOptions = useMemo(
        () => withUnknownOption(filterOptions.locations, serverAnalytics?.hasUnknownLocation || filters.locations.includes('Unknown')),
        [filterOptions.locations, filters.locations, serverAnalytics?.hasUnknownLocation]
    );
    const evidenceFilterOptions = useMemo(
        () => withUnknownOption(filterOptions.evidence, serverAnalytics?.hasUnknownEvidence || filters.evidence.includes('Unknown')),
        [filterOptions.evidence, filters.evidence, serverAnalytics?.hasUnknownEvidence]
    );

    const analytics = useMemo(() => {
        const source = serverAnalytics || {};
        const trendItems = Array.isArray(source.trendSource) ? source.trendSource : [];
        const aggregatedTrends = buildTrendSeriesFromBuckets({
            buckets: Array.isArray(source.trendBuckets) ? source.trendBuckets : [],
            dateRange,
            fallbackDays: 14,
        });
        return {
            total: source.total || 0,
            open: source.open || 0,
            inProgress: source.inProgress || 0,
            closed: source.closed || 0,
            lettersIssued: source.lettersIssued || 0,
            active: source.active || 0,
            unassigned: source.unassigned || 0,
            resolutionRate: source.resolutionRate || '0%',
            statusData: (source.statusData || []).map((entry) => ({
                ...entry,
                color: entry.name === 'Open'
                    ? STATUS_COLORS.Open
                    : entry.name === 'Closed'
                        ? STATUS_COLORS.Closed
                        : STATUS_COLORS['In Progress'],
            })),
            statusTrendData: source.trendBuckets ? aggregatedTrends.statusTrendData : buildStatusTrendSeries({
                items: trendItems,
                dateRange,
                fallbackDays: 14,
            }),
            creationTrendData: source.trendBuckets ? aggregatedTrends.creationTrendData : buildCreationTrendSeries({
                items: trendItems,
                dateRange,
                fallbackDays: 14,
            }),
            categoryData: source.categoryData || [],
            locationData: source.locationData || [],
            evidenceData: source.evidenceData || [],
            classWiseData: source.classWiseData || [],
            staffWorkload: source.staffWorkload || [],
            categoryHeatmap: source.categoryHeatmap || [],
            academicYearData: source.academicYearData || [],
        };
    }, [dateRange, serverAnalytics]);

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

    const hasActiveFilters =
        filters.classes.length > 0 ||
        filters.sections.length > 0 ||
        filters.incidentTypes.length > 0 ||
        filters.locations.length > 0 ||
        filters.evidence.length > 0 ||
        filters.statuses.length > 0 ||
        selectedStaff.length > 0 ||
        academicYear !== currentAcademicYear ||
        Boolean(dateRange.start) ||
        Boolean(dateRange.end);

    const activeFilterLabels = useMemo(() => [
        academicYear && academicYear !== currentAcademicYear ? `Year: ${academicYear}` : null,
        dateRange.start || dateRange.end ? `Dates: ${dateRange.start || 'Any'} to ${dateRange.end || 'Any'}` : null,
        ...filters.classes.map((value) => `Class: ${value}`),
        ...filters.sections.map((value) => `Section: ${value}`),
        ...filters.incidentTypes.map((value) => `Category: ${value}`),
        ...filters.locations.map((value) => `Location: ${value}`),
        ...filters.evidence.map((value) => `Evidence: ${value}`),
        ...filters.statuses.map((value) => `Status: ${value}`),
        ...selectedStaff.map((value) => `Staff: ${value}`),
    ].filter(Boolean), [academicYear, currentAcademicYear, dateRange.end, dateRange.start, filters.classes, filters.evidence, filters.incidentTypes, filters.locations, filters.sections, filters.statuses, selectedStaff]);

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
        setAcademicYear(currentAcademicYear);
    }, [currentAcademicYear, isOperationalUser, user?.name]);

    const exportIncidentDetailsToExcel = useCallback(async () => {
        let downloadFeedbackStarted = false;
        try {
            setIsExporting(true);
            const firstPage = await fetchAnalyticsDetails({ updateState: false, page: 1, limit: 100 });
            const exportRows = [...firstPage.data];
            const exportLetterStatusMap = { ...firstPage.letterStatusMap };
            const totalPages = firstPage.pagination?.totalPages || 1;
            for (let page = 2; page <= totalPages; page += 1) {
                const nextPage = await fetchAnalyticsDetails({ updateState: false, page, limit: 100 });
                exportRows.push(...nextPage.data);
                Object.assign(exportLetterStatusMap, nextPage.letterStatusMap);
            }
            const exportIncidentDetails = exportRows.sort((a, b) => {
                const classA = String(a.class || a.studentDetails?.className || '').toLowerCase();
                const classB = String(b.class || b.studentDetails?.className || '').toLowerCase();
                if (classA !== classB) return classA.localeCompare(classB);

                const sectionA = String(a.section || a.studentDetails?.section || '').toLowerCase();
                const sectionB = String(b.section || b.studentDetails?.section || '').toLowerCase();
                if (sectionA !== sectionB) return sectionA.localeCompare(sectionB);

                return String(a.studentDetails?.name || '').localeCompare(String(b.studentDetails?.name || ''));
            });

            const excelData = exportIncidentDetails.map((incident) => {
                const incidentId = incident._id || incident.id;
                const letterInfo = exportLetterStatusMap[incidentId] || {};

                return {
                    'Admission Number': incident.admissionNo || 'N/A',
                    'Student Name': incident.studentDetails?.name || incident.studentsInvolved?.[0] || 'N/A',
                    Class: incident.class || incident.studentDetails?.className || 'N/A',
                    Section: incident.section || incident.studentDetails?.section || 'N/A',
                    Category: incident.category || 'N/A',
                    Description: incident.description || '',
                    Priority: resolveIncidentPriorityForExport(incident),
                    'Progress Log': formatProgressLogForExport(incident.progressLogs),
                    Location: incident.location || 'N/A',
                    Evidence: (incident.evidence || []).map((entry) => entry?.evidenceType).filter(Boolean).join(', ') || 'None',
                    Reporter: incident.reportedBy?.name || 'Unknown',
                    Handler: resolveHandlerLabel(incident),
                    Status: incident.status || 'N/A',
                    Opened: formatShortDate(getIncidentTimestamp(incident)),
                    Closed: formatShortDate(incident.closedAt),
                    Letter: letterInfo.hasLetter ? 'Issued' : 'Not issued',
                };
            });

            const ws = XLSX.utils.json_to_sheet(excelData, {
                header: ['Admission Number', 'Student Name', 'Class', 'Section', 'Category', 'Description', 'Priority', 'Progress Log', 'Location', 'Evidence', 'Reporter', 'Handler', 'Status', 'Opened', 'Closed', 'Letter'],
            });
            const wb = XLSX.utils.book_new();
            const exportDate = new Date().toISOString().split('T')[0];
            const reportInfoWs = XLSX.utils.json_to_sheet([
                { Field: 'Report', Value: 'Incident Details' },
                { Field: 'Generated On', Value: exportDate },
                { Field: 'Academic Year', Value: academicYear || currentAcademicYear || 'All years' },
                { Field: 'Date Range', Value: dateRange.start || dateRange.end ? `${dateRange.start || 'Any'} to ${dateRange.end || 'Any'}` : 'All dates' },
                { Field: 'Classes', Value: filters.classes.length ? filters.classes.join(', ') : 'All classes' },
                { Field: 'Sections', Value: filters.sections.length ? filters.sections.join(', ') : 'All sections' },
                { Field: 'Categories', Value: filters.incidentTypes.length ? filters.incidentTypes.join(', ') : 'All categories' },
                { Field: 'Locations', Value: filters.locations.length ? filters.locations.join(', ') : 'All locations' },
                { Field: 'Evidence Types', Value: filters.evidence.length ? filters.evidence.join(', ') : 'All evidence types' },
                { Field: 'Statuses', Value: filters.statuses.length ? filters.statuses.join(', ') : 'All statuses' },
                { Field: 'Staff', Value: selectedStaff.length ? selectedStaff.join(', ') : 'All staff' },
                { Field: 'Record Count', Value: exportIncidentDetails.length },
            ]);
            XLSX.utils.book_append_sheet(wb, reportInfoWs, 'Report Info');
            XLSX.utils.book_append_sheet(wb, ws, 'Incident Details');
            const academicYearSheetData = analytics.academicYearData.map((entry) => ({
                'Academic Year': entry.academicYear,
                'Total Incidents': entry.total,
                Open: entry.open,
                'In Progress': entry.inProgress,
                Closed: entry.closed,
                Unresolved: entry.unresolved,
            }));
            const academicYearWs = XLSX.utils.json_to_sheet(academicYearSheetData);
            XLSX.utils.book_append_sheet(wb, academicYearWs, 'Academic Year Status');
            downloadFeedbackStarted = true;
            await withFeedback(
                addToast,
                () => downloadWorkbook(
                    XLSX,
                    wb,
                    `Incident_Details_${slugifyExportPart(academicYear || currentAcademicYear || 'All_Years')}_${exportDate}.xlsx`,
                    { title: 'Incident Details Export' }
                ),
                {
                    successMessage: 'Excel exported successfully.',
                    errorMessage: 'Export failed. Please try again.',
                }
            );
        } catch (error) {
            if (!downloadFeedbackStarted) {
                addToast(error.response?.data?.message || error.message || 'Export failed. Please try again.', 'error');
            }
        } finally {
            setIsExporting(false);
        }
    }, [academicYear, addToast, analytics.academicYearData, currentAcademicYear, dateRange.end, dateRange.start, fetchAnalyticsDetails, filters.classes, filters.evidence, filters.incidentTypes, filters.locations, filters.sections, filters.statuses, selectedStaff]);

    if (loading && !serverAnalytics) {
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

    if (analyticsError && !serverAnalytics) {
        return (
            <div className="flex min-h-screen bg-slate-100">
                <div className="flex min-w-0 flex-1 flex-col">
                    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                        <div className="mx-auto max-w-[1600px]">
                            <EmptyStatePanel
                                title="Analytics could not be loaded"
                                description={analyticsError}
                                action={(
                                    <button
                                        type="button"
                                        onClick={fetchAnalytics}
                                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        Retry analytics
                                    </button>
                                )}
                            />
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    const detailColumns = [
        { key: 'admissionNo', label: 'Admission Number', render: (row) => <span className="font-mono text-xs text-slate-600">{row.admissionNo || 'N/A'}</span> },
        { key: 'studentName', label: 'Student', render: (row) => row.studentDetails?.name || row.studentsInvolved?.[0] || 'N/A' },
        { key: 'className', label: 'Class', render: (row) => row.class || row.studentDetails?.className || 'N/A' },
        { key: 'section', label: 'Section', render: (row) => row.section || row.studentDetails?.section || 'N/A' },
        { key: 'category', label: 'Type', render: (row) => formatDisplayValue(row.category) || 'N/A' },
        {
            key: 'description',
            label: 'Description',
            className: 'min-w-[220px] max-w-[320px]',
            render: (row) => (
                <span className="block whitespace-pre-wrap text-sm leading-5 text-slate-700">
                    {row.description || 'N/A'}
                </span>
            ),
        },
        { key: 'priority', label: 'Priority', render: (row) => resolveIncidentPriorityForExport(row) },
        {
            key: 'progressLog',
            label: 'Progress Log',
            className: 'min-w-[220px] max-w-[320px]',
            render: (row) => (
                <span className="block whitespace-pre-wrap text-sm leading-5 text-slate-700">
                    {formatProgressLogForDisplay(row.progressLogs)}
                </span>
            ),
        },
        { key: 'location', label: 'Location', render: (row) => formatDisplayValue(row.location) || 'N/A' },
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
                    {formatDisplayValue(row.status)}
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
        { key: 'actions', label: 'Actions', render: (row) => (<button type="button" onClick={() => navigate(`/incidents/${row._id || row.id}`)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800">View Details</button>), },
    ];

    const statusTrendColumns = [
        { key: 'name', label: 'Period' },
        { key: 'open', label: 'Open' },
        { key: 'inProgress', label: 'In progress' },
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
        { key: 'name', label: 'Status', render: (row) => formatDisplayValue(row.name) },
        { key: 'value', label: 'Incidents' },
        { key: 'share', label: 'Share' },
    ];

    const workloadColumns = [
        { key: 'name', label: 'Staff Member' },
        { key: 'open', label: 'Open' },
        { key: 'inProgress', label: 'In progress' },
        { key: 'closed', label: 'Closed' },
        { key: 'total', label: 'Total' },
    ];

    const categoryHeatmapColumns = [
        { key: 'label', label: 'Category', render: (row) => formatDisplayValue(row.label) },
        { key: 'open', label: 'Open' },
        { key: 'inProgress', label: 'In progress' },
        { key: 'closed', label: 'Closed' },
        { key: 'total', label: 'Total' },
    ];

    const categoryHeatmapRows = analytics.categoryHeatmap.map((row) => ({
        ...row,
        total: row.open + row.inProgress + row.closed,
    }));

    const categoryColumns = [
        { key: 'name', label: 'Category', render: (row) => formatDisplayValue(row.name) },
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
        { key: 'name', label: 'Location', render: (row) => formatDisplayValue(row.name) },
        { key: 'count', label: 'Incidents' },
    ];

    return (
        <div className="flex min-h-screen bg-slate-100">
            <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-6">
                        <DashboardHero
                            eyebrow="Reports & trends"
                            title="School Analytics"
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
                                Case Details
                                    </button>
                                </div>
                            }
                            meta={
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                        {analytics.total} Filtered Incident{analytics.total === 1 ? '' : 's'}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                        Resolution Rate {analytics.resolutionRate}
                                    </span>
                                </div>
                            }
                        />

                        <UnifiedFilterBar
                            hasActiveFilters={hasActiveFilters}
                            onReset={resetFilters}
                            title="Search & Filters"
                            activeFilterLabels={activeFilterLabels}
                            collapsible
                            defaultCollapsed
                            actions={
                                <button
                                    type="button"
                                    onClick={exportIncidentDetailsToExcel}
                                    disabled={isExporting}
                                    className="btn-export"
                                >
                                    <Download size={14} />
                                    {isExporting ? 'Exporting…' : 'Export to Excel'}
                                </button>
                            }
                        >
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8">
                                <label className="min-w-0">
                                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Academic Year</span>
                                    <select
                                        value={academicYear}
                                        onChange={(event) => setAcademicYear(event.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                                    >
                                        {academicYearOptions.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
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
                                    placeholder="All classes"
                                    searchPlaceholder="Search classes…"
                                />
                                <UnifiedMultiSelect
                                    label="Section"
                                    options={filterOptions.sections}
                                    selected={filters.sections}
                                    onChange={(value) => setFilters((current) => ({ ...current, sections: value }))}
                                    placeholder="All sections"
                                    searchPlaceholder="Search sections…"
                                />
                                <UnifiedMultiSelect
                                    label="Incident Category"
                                    options={filterOptions.incidentTypes}
                                    selected={filters.incidentTypes}
                                    onChange={(value) => setFilters((current) => ({ ...current, incidentTypes: value }))}
                                    placeholder="All categories"
                                    searchPlaceholder="Search categories…"
                                />
                                <UnifiedMultiSelect
                                    label="Location"
                                    options={locationFilterOptions}
                                    selected={filters.locations}
                                    onChange={(value) => setFilters((current) => ({ ...current, locations: value }))}
                                    placeholder="All locations"
                                    searchPlaceholder="Search locations…"
                                />
                                <UnifiedMultiSelect
                                    label="Evidence Type"
                                    options={evidenceFilterOptions}
                                    selected={filters.evidence}
                                    onChange={(value) => setFilters((current) => ({ ...current, evidence: value }))}
                                    placeholder="All evidence types"
                                    searchPlaceholder="Search evidence types…"
                                />
                                <UnifiedMultiSelect
                                    label="Status"
                                    options={STATUS_OPTIONS}
                                    selected={filters.statuses}
                                    onChange={(value) => setFilters((current) => ({ ...current, statuses: value }))}
                                    placeholder="All statuses"
                                    searchPlaceholder="Search statuses…"
                                />
                                {!isOperationalUser ? (
                                    <UnifiedMultiSelect
                                        label="Staff Members"
                                        options={allStaffOptions}
                                        selected={selectedStaff}
                                        onChange={setSelectedStaff}
                                        placeholder="All staff"
                                        searchPlaceholder="Search staff…"
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
                                    <DashboardStatCard title="Letters Sent" value={analytics.lettersIssued} icon={TrendingUp} tone="cyan" helper="Letters completed for these incidents" />
                                </div>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                                    <DashboardWidgetPanel
                                        className="xl:col-span-7"
                                        title="Incident Status over Time"
                                        description="Shows how counts of open, in-progress, and closed incidents change day by day."
                                        icon={TrendingUp}
                                        chart={<IncidentStatusTrendChart data={analytics.statusTrendData} idPrefix="professional-status" />}
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'Open', color: STATUS_COLORS.Open },
                                                    { label: 'In progress', color: STATUS_COLORS['In Progress'] },
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
                                        title="New Incidents by Day"
                                        description="Counts how many new incident reports appear on each calendar day."
                                        icon={AlertTriangle}
                                        chart={<DailyCreationTrendChart data={analytics.creationTrendData} />}
                                        tableColumns={creationTrendColumns}
                                        tableRows={analytics.creationTrendData}
                                        emptyMessage="No creation trend data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-12"
                                        title="Incidents by Academic Year"
                                        description="Compares yearly incident volume and resolution status."
                                        icon={BarChart3}
                                        chart={
                                            <ChartSurface height={300}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                    <BarChart data={analytics.academicYearData} margin={horizontalBarMargin}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                                                        <XAxis dataKey="name" {...compactXAxisProps} />
                                                        <YAxis allowDecimals={false} {...compactYAxisProps} />
                                                        <Tooltip cursor={false} content={<AcademicYearStatusTooltip />} />
                                                        <Bar dataKey="open" stackId="academic-year-status" fill={STATUS_COLORS.Open} name="Open" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="inProgress" stackId="academic-year-status" fill={STATUS_COLORS['In Progress']} name="In progress" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="closed" stackId="academic-year-status" fill={STATUS_COLORS.Closed} name="Closed" radius={[6, 6, 0, 0]}>
                                                            <LabelList dataKey="total" position="top" className="fill-slate-600 text-xs font-semibold" />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ChartSurface>
                                        }
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'Open', color: STATUS_COLORS.Open },
                                                    { label: 'In progress', color: STATUS_COLORS['In Progress'] },
                                                    { label: 'Closed', color: STATUS_COLORS.Closed },
                                                ]}
                                            />
                                        }
                                        tableColumns={[
                                            { key: 'academicYear', label: 'Academic Year' },
                                            { key: 'total', label: 'Total' },
                                            { key: 'open', label: 'Open' },
                                            { key: 'inProgress', label: 'In progress' },
                                            { key: 'closed', label: 'Closed' },
                                            { key: 'unresolved', label: 'Unresolved' },
                                        ]}
                                        tableRows={analytics.academicYearData}
                                        emptyMessage="No academic year data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-5"
                                        title="Where Incidents Stand Today"
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
                                        title="Workload by Staff Member"
                                        description="Shows how incidents are divided among staff—for open work, ongoing follow-up, and completed cases."
                                        icon={Users}
                                        chart={
                                            analytics.staffWorkload.length === 0 ? (
                                                <EmptyStatePanel
                                                    title="No workload data."
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
                                                        <Bar dataKey="inProgress" stackId="workload" fill={STATUS_COLORS['In Progress']} name="In progress" />
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
                                        title="Category Summary (Grid View)"
                                        description="See how often each incident type appears while open, in progress, or already closed."
                                        icon={BarChart3}
                                        chart={
                                            <CategoryHeatmap
                                                rows={analytics.categoryHeatmap}
                                                columns={[
                                                    { key: 'open', label: 'Open', rgb: '249, 115, 22' },
                                                    { key: 'inProgress', label: 'In progress', rgb: '59, 130, 246' },
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
                                                <EmptyStatePanel title="No evidence data." description="No evidence records are available for the current filters." />
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
                                title="Single Incident Breakdown"
                                description="Sortable, exportable detail view of every incident included in the current analytics scope."
                                icon={List}
                            >
                                <AnalyticsDataTable
                                    columns={detailColumns}
                                    rows={filteredIncidentDetails}
                                    emptyMessage="No incidents found for the current filter set."
                                />
                                {detailPagination?.totalPages > 1 ? (
                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
                                        <span className="text-slate-500">
                                            Page {detailPagination.page} of {detailPagination.totalPages} · {detailPagination.total} incidents
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={detailPage <= 1}
                                                onClick={() => setDetailPage((page) => Math.max(1, page - 1))}
                                                className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-50"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                type="button"
                                                disabled={detailPage >= detailPagination.totalPages}
                                                onClick={() => setDetailPage((page) => Math.min(detailPagination.totalPages, page + 1))}
                                                className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </DashboardPanel>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ProfessionalAnalytics;
