import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    resolveUserLabel,
    STATUS_COLORS,
    STATUS_OPTIONS,
    buildCreationTrendSeries,
    buildAcademicYearOptions,
    buildManagementReportWorksheet,
    buildStatusTrendSeries,
    buildTrendSeriesFromBuckets,
    formatProgressLogForExport,
    formatShortDate,
    getIncidentTimestamp,
    normalizeOptionList,
    resolveIncidentPriorityForExport,
    toneForStatus,
    withUnknownOption,
    formatDisplayValue,
    getFilteredSections,
} from '../utils/analytics';
import { downloadWorkbook } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';
import { isTeacherRole } from '../utils/roles';

const slugifyExportPart = (value, fallback = 'all') => {
    const clean = String(value || fallback).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    return clean || fallback;
};

const AcademicYearStatusTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload || {};

    return (
        <div className="max-w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white/95 px-2.5 py-2 shadow-xl backdrop-blur">
            <p className="mb-1.5 break-words text-[11px] font-semibold uppercase leading-4 tracking-[0.14em] text-slate-500">
                {row.academicYear || label || 'Academic Year'}
            </p>
            <div className="space-y-1">
                {[
                    { label: 'Total Incidents', value: row.total, color: CHART_COLORS.neutralPrimary },
                    { label: 'Pending', value: row.pending || row.open, color: STATUS_COLORS.Pending },
                    { label: 'Closed', value: row.closed, color: STATUS_COLORS.Closed },
                ].map((entry) => (
                    <div key={entry.label} className="flex items-start justify-between gap-3 text-[13px] leading-5">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="break-words text-slate-600">{entry.label}</span>
                        </div>
                        <span className="font-semibold text-slate-900 ">
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
    const [detailsLoading, setDetailsLoading] = useState(false);
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
        classSectionMap: {},
        incidentTypes: [],
        locations: [],
        evidence: [],
    });

    const filteredSections = useMemo(() => {
        return getFilteredSections(filters.classes, filterOptions.sections, filterOptions.classSectionMap);
    }, [filters.classes, filterOptions.sections, filterOptions.classSectionMap]);

    useEffect(() => {
        if (filters.sections?.length > 0) {
            const validSections = getFilteredSections(filters.classes, filterOptions.sections, filterOptions.classSectionMap);
            const nextSections = filters.sections.filter((sec) => validSections.includes(sec));
            if (nextSections.length !== filters.sections.length) {
                setFilters((current) => ({ ...current, sections: nextSections }));
            }
        }
    }, [filters.classes, filterOptions.sections, filterOptions.classSectionMap, filters.sections]);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [academicYear, setAcademicYear] = useState('');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const [academicYears, setAcademicYears] = useState([]);
    const [letterStatusMap, setLetterStatusMap] = useState({});
    const analyticsRequestRef = useRef({ controller: null, id: 0 });
    const filterMetadataRef = useRef({ userId: '', data: null });
    const staffMetadataRef = useRef({ userId: '', data: null });
    const loadedDetailsQueryRef = useRef('');
    const config = useMemo(() => ({ headers: {} }), []);
    const compactXAxisProps = useMemo(
        () => ({
            height: compactChart ? 72 : 55,
            interval: 0,
            tickMargin: compactChart ? 12 : 8,
            tick: <CompactXAxisTick maxLength={compactChart ? 12 : 18} />
        }),
        [compactChart]
    );
    const compactYAxisProps = useMemo(
        () => ({
            tick: <CompactYAxisTick maxLength={compactChart ? 17 : 24} />
        }),
        [compactChart]
    );
    const horizontalBarMargin = useMemo(
        () => ({
            top: compactChart ? 24 : 20,
            right: compactChart ? 12 : 10,
            left: 0,
            bottom: compactChart ? 36 : 28
        }),
        [compactChart]
    );
    const academicYearOptions = useMemo(
        () => buildAcademicYearOptions(academicYears, currentAcademicYear),
        [academicYears, currentAcademicYear]
    );

    const allStaffOptions = useMemo(
        () => staffList.map((staff) => resolveUserLabel(staff)),
        [staffList]
    );

    const buildRequestParams = useCallback(() => {
        const allSelected = allStaffOptions.length > 0 && selectedStaff.length === allStaffOptions.length;
        const staffIds = selectedStaff.length > 0 && !allSelected
            ? staffList
                .filter((staff) => selectedStaff.includes(resolveUserLabel(staff)))
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
            includeAdminRole: false,
            includeUnassigned: false,
        });
        if (academicYear) params.set('academicYear', academicYear);
        params.set('timezoneOffsetMinutes', String(new Date().getTimezoneOffset()));
        return params;
    }, [academicYear, allStaffOptions.length, dateRange.end, dateRange.start, filters.classes, filters.evidence, filters.incidentTypes, filters.locations, filters.sections, filters.statuses, selectedStaff, staffList]);

    const fetchAnalytics = useCallback(async () => {
        if (!user?._id || !academicYear) return;
        analyticsRequestRef.current.controller?.abort();
        const controller = new AbortController();
        const requestId = analyticsRequestRef.current.id + 1;
        analyticsRequestRef.current = { controller, id: requestId };
        const isCurrentRequest = () => analyticsRequestRef.current.id === requestId;
        try {
            setLoading(true);
            setAnalyticsError('');
            const params = buildRequestParams();
            const { data } = await apiClient.get('/api/incidents/analytics', { ...config, params, signal: controller.signal });
            if (!isCurrentRequest()) return;
            const requiredArrays = ['statusData', 'categoryData', 'locationData', 'evidenceData', 'classWiseData', 'staffWorkload', 'categoryHeatmap', 'academicYearData', 'trendBuckets'];
            if (
                !data
                || typeof data !== 'object'
                || !['total', 'pending', 'closed', 'lettersIssued'].every((key) => Number.isFinite(Number(data[key])))
                || !requiredArrays.every((key) => Array.isArray(data[key]))
            ) {
                throw new Error('Analytics endpoint returned an invalid response.');
            }
            setServerAnalytics(data || null);
            setIncidents([]);
            setLetterStatusMap({});
        } catch (error) {
            if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
            if (!isCurrentRequest()) return;
            setServerAnalytics(null);
            setIncidents([]);
            setLetterStatusMap({});
            setAnalyticsError(error.response?.data?.message || error.message || 'Analytics data could not be loaded.');
        } finally {
            if (isCurrentRequest()) {
                setLoading(false);
            }
        }
    }, [academicYear, buildRequestParams, config, user?._id]);

    useEffect(() => () => {
        analyticsRequestRef.current.controller?.abort();
    }, []);

    const fetchAnalyticsDetails = useCallback(async ({ updateState = true, page = 1, limit = 100, fetchAll = false } = {}) => {
        if (!user?._id || !academicYear) return { data: [], letterStatusMap: {} };
        const fetchPage = async (nextPage) => {
            const params = buildRequestParams();
            params.set('page', String(nextPage));
            params.set('limit', String(limit));
            const { data } = await apiClient.get('/api/incidents/analytics/details', { ...config, params });
            return {
                data: Array.isArray(data?.data) ? data.data : [],
                letterStatusMap: data?.letterStatusMap || {},
                pagination: data?.pagination || null,
            };
        };

        const payload = await fetchPage(page);
        if (fetchAll) {
            const totalPages = payload.pagination?.totalPages || 1;
            for (let nextPage = page + 1; nextPage <= totalPages; nextPage += 1) {
                const nextPayload = await fetchPage(nextPage);
                payload.data.push(...nextPayload.data);
                Object.assign(payload.letterStatusMap, nextPayload.letterStatusMap);
                payload.pagination = nextPayload.pagination || payload.pagination;
            }
        }
        if (updateState) {
            setIncidents(payload.data);
            setLetterStatusMap(payload.letterStatusMap);
        }
        return payload;
    }, [academicYear, buildRequestParams, config, user?._id]);

    const fetchFilterOptions = useCallback(async () => {
        if (!user?._id) return;

        try {
            const studentFilterConfig = academicYear ? { ...config, params: { academicYear } } : config;
            let metadata = filterMetadataRef.current;
            if (metadata.userId !== user._id || !metadata.data) {
                const [categoriesRes, locationsRes, evidenceRes, yearsRes] = await Promise.all([
                    apiClient.get('/api/incidents/categories', config),
                    apiClient.get('/api/incidents/locations', { ...config, params: { includeUnknown: true } }),
                    apiClient.get('/api/evidence-types', { ...config, params: { includeUnknown: true } }),
                    apiClient.get('/api/auth/academic-years', config),
                ]);
                metadata = {
                    userId: user._id,
                    data: { categoriesRes, locationsRes, evidenceRes, yearsRes },
                };
                filterMetadataRef.current = metadata;
            }

            const studentsRes = await apiClient.get('/api/students/filters', studentFilterConfig);
            const { categoriesRes, locationsRes, evidenceRes, yearsRes } = metadata.data;

            const nextYears = yearsRes.data?.academicYears || [];
            setAcademicYears(nextYears);
            setCurrentAcademicYear(yearsRes.data?.currentAcademicYear || '');
            setAcademicYear((current) => current || yearsRes.data?.currentAcademicYear || nextYears[nextYears.length - 1] || '');
            setFilterOptions({
                classes: studentsRes.data?.classes || [],
                sections: studentsRes.data?.sections || [],
                classSectionMap: studentsRes.data?.classSectionMap || {},
                incidentTypes: normalizeOptionList(categoriesRes.data),
                locations: normalizeOptionList(locationsRes.data),
                evidence: normalizeOptionList(evidenceRes.data),
            });
        } catch {
            setFilterOptions({
                classes: [],
                sections: [],
                classSectionMap: {},
                incidentTypes: [],
                locations: [],
                evidence: [],
            });
        }
    }, [academicYear, config, user?._id]);

    const fetchStaff = useCallback(async () => {
        if (!user?._id) return;

        try {
            if (staffMetadataRef.current.userId === user._id && staffMetadataRef.current.data) {
                setStaffList(staffMetadataRef.current.data);
                return;
            }
            const { data } = await apiClient.get('/api/auth/users', config);
            // Keep ALL users in staffList (role info needed for filter logic);
            // admins are excluded from the dropdown via allStaffOptions.
            const nextStaff = Array.isArray(data) ? data : [];
            staffMetadataRef.current = { userId: user._id, data: nextStaff };
            setStaffList(nextStaff);
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
        const detailsQueryKey = buildRequestParams().toString();
        if (loadedDetailsQueryRef.current === detailsQueryKey) return;

        let mounted = true;
        setDetailsLoading(true);
        const loadDetails = async () => {
            try {
                const payload = await fetchAnalyticsDetails({ fetchAll: true, limit: 100, updateState: false });
                if (!mounted) return;
                setIncidents(payload.data);
                setLetterStatusMap(payload.letterStatusMap);
                loadedDetailsQueryRef.current = detailsQueryKey;
            } catch {
                try {
                    const params = buildRequestParams();
                    const { data } = await apiClient.get('/api/incidents', { ...config, params });
                    if (!mounted) return;
                    setIncidents(Array.isArray(data) ? data : []);
                } catch {
                    if (!mounted) return;
                    setIncidents([]);
                }
                if (!mounted) return;
                setLetterStatusMap({});
                loadedDetailsQueryRef.current = detailsQueryKey;
            } finally {
                if (mounted) setDetailsLoading(false);
            }
        };

        void loadDetails();
        return () => {
            mounted = false;
        };
    }, [activeTab, buildRequestParams, config, fetchAnalyticsDetails, serverAnalytics]);

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
        const trendBuckets = Array.isArray(source.trendBuckets) ? source.trendBuckets : [];
        const hasTrendBuckets = trendBuckets.length > 0;
        const aggregatedTrends = buildTrendSeriesFromBuckets({
            buckets: trendBuckets,
            dateRange,
            fallbackDays: 14,
        });
        const fallbackStatusTrendData = buildStatusTrendSeries({
            items: trendItems,
            dateRange,
            fallbackDays: 14,
        });
        const fallbackCreationTrendData = buildCreationTrendSeries({
            items: trendItems,
            dateRange,
            fallbackDays: 14,
        });
        return {
            total: source.total || 0,
            pending: source.pending || source.open || 0,
            open: source.pending || source.open || 0,
            inProgress: 0,
            closed: source.closed || 0,
            lettersIssued: source.lettersIssued || 0,
            active: source.pending || source.open || 0,
            unassigned: source.unassigned || 0,
            resolutionRate: source.resolutionRate || '0%',
            statusData: (source.statusData || []).map((entry) => ({
                ...entry,
                color: entry.name === 'Closed'
                    ? STATUS_COLORS.Closed
                    : STATUS_COLORS.Pending,
            })),
            statusTrendData: hasTrendBuckets ? aggregatedTrends.statusTrendData : fallbackStatusTrendData,
            creationTrendData: hasTrendBuckets ? aggregatedTrends.creationTrendData : fallbackCreationTrendData,
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
                    Reporter: resolveUserLabel(incident.reportedBy, 'Unknown'),
                    Handler: resolveHandlerLabel(incident),
                    Status: incident.status || 'N/A',
                    Opened: formatShortDate(getIncidentTimestamp(incident)),
                    Closed: formatShortDate(incident.closedAt),
                    Letter: letterInfo.hasLetter ? 'Issued' : 'Not issued',
                };
            });

            const exportColumns = ['Admission Number', 'Student Name', 'Class', 'Section', 'Category', 'Description', 'Priority', 'Progress Log', 'Location', 'Evidence', 'Reporter', 'Handler', 'Status', 'Opened', 'Closed', 'Letter'];
            const wb = XLSX.utils.book_new();
            const generatedAt = new Date();
            const exportDate = generatedAt.toISOString().split('T')[0];
            const ws = buildManagementReportWorksheet(XLSX, {
                reportTitle: 'School Analytics Report',
                generatedBy: user?.name || user?.email || 'Unknown',
                generatedOn: generatedAt,
                academicYear: academicYear || currentAcademicYear || 'All years',
                appliedFilters: [
                    { label: 'Date Range', value: dateRange.start || dateRange.end ? `${dateRange.start || 'Any'} to ${dateRange.end || 'Any'}` : '' },
                    { label: 'Class', value: filters.classes },
                    { label: 'Section', value: filters.sections },
                    { label: 'Category', value: filters.incidentTypes },
                    { label: 'Location', value: filters.locations },
                    { label: 'Evidence Type', value: filters.evidence },
                    { label: 'Status', value: filters.statuses },
                    { label: 'Assigned To', value: selectedStaff },
                ],
                totalRecords: exportIncidentDetails.length,
                columns: exportColumns,
                rows: excelData,
            });
            XLSX.utils.book_append_sheet(wb, ws, 'Incident Details');
            const academicYearSheetData = analytics.academicYearData.map((entry) => ({
                'Academic Year': entry.academicYear,
                'Total Incidents': entry.total,
                Pending: entry.pending || entry.open,
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
    }, [academicYear, addToast, analytics.academicYearData, currentAcademicYear, dateRange.end, dateRange.start, fetchAnalyticsDetails, filters.classes, filters.evidence, filters.incidentTypes, filters.locations, filters.sections, filters.statuses, selectedStaff, user?.email, user?.name]);

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
        { key: 'serialNumber', label: 'S.No', render: (row, index) => index + 1 },
        { key: 'admissionNo', label: 'Admission Number', render: (row) => <span className="font-mono text-xs text-slate-600">{row.admissionNo || 'N/A'}</span> },
        { key: 'studentName', label: 'Student', render: (row) => row.studentDetails?.name || row.studentsInvolved?.[0] || 'N/A' },
        { key: 'className', label: 'Class', render: (row) => row.class || row.studentDetails?.className || 'N/A' },
        { key: 'section', label: 'Section', render: (row) => row.section || row.studentDetails?.section || 'N/A' },
        { key: 'category', label: 'Type', render: (row) => formatDisplayValue(row.category) || 'N/A' },
        { key: 'priority', label: 'Priority', render: (row) => resolveIncidentPriorityForExport(row) },
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
        { key: 'reporter', label: 'Reporter', render: (row) => resolveUserLabel(row.reportedBy, 'Unknown') },
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
        { key: 'pending', label: 'Pending' },
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
        { key: 'pending', label: 'Pending' },
        { key: 'closed', label: 'Closed' },
        { key: 'total', label: 'Total' },
    ];

    const categoryHeatmapColumns = [
        { key: 'label', label: 'Category', render: (row) => formatDisplayValue(row.label) },
        { key: 'pending', label: 'Pending' },
        { key: 'closed', label: 'Closed' },
        { key: 'total', label: 'Total' },
    ];

    const categoryHeatmapRows = analytics.categoryHeatmap.map((row) => ({
        ...row,
        pending: row.pending || row.open || 0,
        total: (row.pending || row.open || 0) + row.closed,
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
        { key: 'pending', label: 'Pending' },
        { key: 'closed', label: 'Closed' },
        { key: 'total', label: 'Total' },
    ];

    const classResolutionRows = analytics.classWiseData.map((row) => ({
        ...row,
        pending: row.pending || row.open || 0,
        total: row.total ?? (row.pending || row.open || 0) + row.closed,
    }));

    const locationColumns = [
        { key: 'name', label: 'Location', render: (row) => formatDisplayValue(row.name) },
        { key: 'count', label: 'Incidents' },
    ];

    return (
        <div className="school-analytics flex min-h-screen bg-[#f6f8fc]">
            <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <DashboardHero
                                eyebrow="Reports & Trends"
                                title="School Analytics"
                                description="View school-wide incident reports and trends."
                                icon={ShieldCheck}
                            />
                            <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1 md:w-auto">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('overview')}
                                        className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition md:flex-none ${activeTab === 'overview' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        <BarChart3 size={16} />
                                        Overview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('details')}
                                        className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition md:flex-none ${activeTab === 'details' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        <List size={16} />
                                        Case Details
                                    </button>
                            </div>
                        </div>

                        <UnifiedFilterBar
                            hasActiveFilters={hasActiveFilters}
                            onReset={resetFilters}
                            title="Search & Filters"
                            activeFilterLabels={activeFilterLabels}
                            collapsible
                            defaultCollapsed={compactChart}
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
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
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
                                    options={filteredSections}
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
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <DashboardStatCard title="Total Incidents" value={analytics.total} icon={FileText} tone="blue" helper="All incidents in current view" />
                                    <DashboardStatCard title="Pending" value={analytics.pending} icon={AlertTriangle} tone="amber" helper="Requires immediate action" />
                                    <DashboardStatCard title="Resolved" value={analytics.closed} icon={CheckCircle} tone="emerald" helper={`Resolution rate ${analytics.resolutionRate}`} />
                                    <DashboardStatCard title="Letters Sent" value={analytics.lettersIssued} icon={TrendingUp} tone="cyan" helper="Letters completed for these incidents" />
                                </div>

                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                                    <DashboardWidgetPanel
                                        className="xl:col-span-7"
                                        title="Incident Status over Time"
                                        description="Shows how counts of pending and closed incidents change day by day."
                                        icon={TrendingUp}
                                        chart={<IncidentStatusTrendChart data={analytics.statusTrendData} idPrefix="professional-status" />}
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'Pending', color: STATUS_COLORS.Pending },
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
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'New Incidents', color: CHART_COLORS.neutralPrimary },
                                                ]}
                                            />
                                        }
                                        tableColumns={creationTrendColumns}
                                        tableRows={analytics.creationTrendData}
                                        emptyMessage="No creation trend data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-7"
                                        title="Incidents by Academic Year"
                                        description="Compares yearly incident volume and resolution status."
                                        icon={BarChart3}
                                        chart={
                                            <ChartSurface height={260}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                    <BarChart data={analytics.academicYearData} margin={horizontalBarMargin}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                                                        <XAxis dataKey="name" {...compactXAxisProps} />
                                                        <YAxis allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} {...compactYAxisProps} />
                                                        <ChartTooltip cursor={false} content={<AcademicYearStatusTooltip />} />
                                                        <Bar dataKey="pending" stackId="academic-year-status" fill={STATUS_COLORS.Pending} name="Pending" radius={[0, 0, 0, 0]} maxBarSize={45} />
                                                        <Bar dataKey="closed" stackId="academic-year-status" fill={STATUS_COLORS.Closed} name="Closed" radius={[6, 6, 0, 0]} maxBarSize={45}>
                                                            <LabelList dataKey="total" position="top" className="fill-slate-600 text-xs font-semibold" />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ChartSurface>
                                        }
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'Pending', color: STATUS_COLORS.Pending },
                                                    { label: 'Closed', color: STATUS_COLORS.Closed },
                                                ]}
                                            />
                                        }
                                        tableColumns={[
                                            { key: 'academicYear', label: 'Academic Year' },
                                            { key: 'total', label: 'Total' },
                                            { key: 'pending', label: 'Pending' },
                                            { key: 'closed', label: 'Closed' },
                                            { key: 'unresolved', label: 'Unresolved' },
                                        ]}
                                        tableRows={analytics.academicYearData}
                                        emptyMessage="No academic year data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-5"
                                        title="Incident Status Mix"
                                        description="Pending and closed incidents as parts of the whole."
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
                                        description="Shows how incidents are divided among staff—for pending work and completed cases."
                                        icon={Users}
                                        chart={
                                            analytics.staffWorkload.length === 0 ? (
                                                <EmptyStatePanel
                                                    title="No workload data."
                                                    description="Adjust the filters to reveal staff handling distribution."
                                                />
                                            ) : (
                                                <ChartSurface height={300}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                <BarChart data={analytics.staffWorkload} margin={horizontalBarMargin}>
                                                         <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                         <XAxis dataKey="name" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                         <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} />
                                                         <ChartTooltip />
                                                         <Bar dataKey="pending" stackId="workload" fill={STATUS_COLORS.Pending} radius={[6, 6, 0, 0]} name="Pending" maxBarSize={45} />
                                                         <Bar dataKey="closed" stackId="workload" fill={STATUS_COLORS.Closed} radius={[6, 6, 0, 0]} name="Closed" maxBarSize={45}>
                                                             <LabelList dataKey="total" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                         </Bar>
                                                     </BarChart>
                                                 </ResponsiveContainer>
 
                                                 </ChartSurface>
                                             )
                                         }
                                         footer={
                                             <LegendList
                                                 items={[
                                                     { label: 'Pending', color: STATUS_COLORS.Pending },
                                                     { label: 'Closed', color: STATUS_COLORS.Closed },
                                                 ]}
                                             />
                                         }
                                         tableColumns={workloadColumns}
                                         tableRows={analytics.staffWorkload}
                                         emptyMessage="No staff workload data is available for the current filters."
                                     />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-6"
                                        title="Category Summary (Grid View)"
                                        description="See how often each incident type appears while pending or already closed."
                                        icon={BarChart3}
                                        chart={
                                            <CategoryHeatmap
                                                rows={categoryHeatmapRows}
                                                columns={[
                                                    { key: 'pending', label: 'Pending', rgb: '249, 115, 22' },
                                                    { key: 'closed', label: 'Closed', rgb: '34, 197, 94' },
                                                ]}
                                            />
                                        }
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'Pending (Incident Volume)', color: STATUS_COLORS.Pending },
                                                    { label: 'Closed (Incident Volume)', color: STATUS_COLORS.Closed },
                                                ]}
                                            />
                                        }
                                        tableColumns={categoryHeatmapColumns}
                                        tableRows={categoryHeatmapRows}
                                        emptyMessage="No category frequency data is available for the current filters."
                                    />
                                    <DashboardWidgetPanel
                                        className="xl:col-span-6"
                                        title="Incidents by Type"
                                        description="Incident types ranked by how often they appear."
                                        icon={FileText}
                                        chart={
                                            <ChartSurface height={280}>
                                                 <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                 <BarChart data={analytics.categoryData.slice(0, 8)} layout="vertical" margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
                                                     <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" horizontal={false} />
                                                     <XAxis type="number" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} />
                                                     <YAxis dataKey="name" type="category" width={compactChart ? 120 : 155} axisLine={false} tickLine={false} {...compactYAxisProps} />
                                                     <ChartTooltip />
                                                     <Bar dataKey="count" fill={CHART_COLORS.category} radius={[0, 8, 8, 0]} name="Incidents" maxBarSize={28}>
                                                         <LabelList dataKey="count" position="right" fill={CHART_THEME.label} fontSize={12} />
                                                     </Bar>
                                                 </BarChart>
                                             </ResponsiveContainer>
 
                                             </ChartSurface>
                                         }
                                         footer={
                                             <LegendList
                                                 items={[
                                                     { label: 'Incident Count', color: CHART_COLORS.category },
                                                 ]}
                                             />
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
                                                <ChartSurface height={240}>
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
                                                        color: [CHART_COLORS.evidence, STATUS_COLORS.Closed, STATUS_COLORS.Pending, CHART_COLORS.category, CHART_COLORS.neutralPrimary][index % 5],
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
                                        description="Pending versus closed cases by class for fast intervention targeting."
                                        icon={TrendingUp}
                                        chart={
                                            <ChartSurface height={280}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                <BarChart data={analytics.classWiseData} margin={horizontalBarMargin}>
                                                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="className" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} />
                                                    <ChartTooltip />
                                                    <Bar dataKey="pending" fill={STATUS_COLORS.Pending} radius={[6, 6, 0, 0]} name="Pending" maxBarSize={30}>
                                                        <LabelList dataKey="pending" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                    </Bar>
                                                    <Bar dataKey="closed" fill={STATUS_COLORS.Closed} radius={[6, 6, 0, 0]} name="Closed" maxBarSize={30}>
                                                        <LabelList dataKey="closed" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>

                                            </ChartSurface>
                                        }
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'Pending', color: STATUS_COLORS.Pending },
                                                    { label: 'Closed', color: STATUS_COLORS.Closed },
                                                ]}
                                            />
                                        }
                                        tableColumns={classResolutionColumns}
                                        tableRows={classResolutionRows}
                                        emptyMessage="No class resolution data is available for the current filters."
                                    />

                                    <DashboardWidgetPanel
                                        className="xl:col-span-6"
                                        title="Top Locations"
                                        description="Most active locations in the filtered incident set."
                                        icon={ShieldCheck}
                                        chart={
                                            <ChartSurface height={280}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                <BarChart data={analytics.locationData.slice(0, 8)} margin={horizontalBarMargin}>
                                                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} />
                                                    <ChartTooltip />
                                                    <Bar dataKey="count" fill={CHART_COLORS.location} radius={[6, 6, 0, 0]} name="Incidents" maxBarSize={45}>
                                                        <LabelList dataKey="count" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>

                                            </ChartSurface>
                                        }
                                        footer={
                                            <LegendList
                                                items={[
                                                    { label: 'Incident Count', color: CHART_COLORS.location },
                                                ]}
                                            />
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
                                    emptyMessage={detailsLoading && analytics.total > 0 ? 'Loading incident records...' : 'No incidents found for the current filter set.'}
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
