import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../config/apiClient';
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
    ArrowLeft,
    CheckCircle,
    Clock,
    Download,
    FileText,
    Loader2,
    Mail,
    Search,
    ShieldCheck,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { UnifiedDateInput, UnifiedFilterBar, UnifiedMultiSelect } from '../components/UnifiedFilters';
import {
    AnalyticsDataTable,
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
import {
    buildCreationTrendSeries,
    buildDistribution,
    buildAcademicYearOptions,
    buildEvidenceDistribution,
    buildIncidentFilterParams,
    buildIssuedLetterFilterParams,
    buildStatusTrendSeries,
    CHART_COLORS,
    formatShare,
    formatShortDate,
    getIncidentTimestamp,
    getLetterTimelineTimestamp,
    hasUnknownEvidenceType,
    hasUnknownLocation,
    normalizeOptionList,
    normalizeToStartOfDay,
    STATUS_COLORS,
    STATUS_OPTIONS,
    toneForStatus,
    withUnknownOption,
} from '../utils/analytics';
import { downloadBlob, downloadWorkbook } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';

const slugify = (value) => {
    if (!value) return 'Student';
    return value.toString().trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 80);
};

const StudentAnalytics = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const params = useParams();
    const compactChart = useCompactChart();

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [sectionFilter, setSectionFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentIncidents, setStudentIncidents] = useState([]);
    const [filters, setFilters] = useState({
        incidentTypes: [],
        locations: [],
        evidence: [],
    });
    const [filterOptions, setFilterOptions] = useState({
        classes: [],
        sections: [],
        incidentTypes: [],
        locations: [],
        evidence: [],
    });
    const [studentLetters, setStudentLetters] = useState([]);
    const [lettersLoading, setLettersLoading] = useState(false);
    const [downloadingLetterId, setDownloadingLetterId] = useState(null);
    const [letterStatusMap, setLetterStatusMap] = useState({});
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [academicYear, setAcademicYear] = useState('');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const [academicYears, setAcademicYears] = useState([]);
    const [locationDistribution, setLocationDistribution] = useState([]);
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

    const filteredStudents = useMemo(
        () =>
            (students || []).filter((student) => {
                const matchesSearch =
                    !searchTerm ||
                    student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    String(student?.admissionNo || '').includes(searchTerm);

                const matchesClass = !classFilter || String(student?.className || '') === String(classFilter);
                const matchesSection = !sectionFilter || String(student?.section || '') === String(sectionFilter);
                return matchesSearch && matchesClass && matchesSection;
            }),
        [classFilter, searchTerm, sectionFilter, students]
    );

    const fetchFilterOptions = useCallback(async () => {
        if (!user?._id) return;
        try {
            const config = academicYear ? { params: { academicYear } } : {};
            const staticConfig = {};
            const [studentsRes, categoriesRes, locationsRes, evidenceRes, yearsRes] = await Promise.all([
                apiClient.get('/api/students/filters', config).catch(() => ({ data: {} })),
                apiClient.get('/api/incidents/categories', staticConfig).catch(() => ({ data: [] })),
                apiClient.get('/api/incidents/locations', { ...staticConfig, params: { includeUnknown: true } }).catch(() => ({ data: [] })),
                apiClient.get('/api/evidence-types', { ...staticConfig, params: { includeUnknown: true } }).catch(() => ({ data: [] })),
                apiClient.get('/api/auth/academic-years', staticConfig).catch(() => ({ data: {} })),
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
    }, [academicYear, user?._id]);

    const fetchStudents = useCallback(async () => {
        if (!user?._id) return;
        try {
            setLoading(true);
            if (!academicYear) return;
            const config = { params: { academicYear } };
            const { data } = await apiClient.get('/api/students/all', config);
            const studentsData = Array.isArray(data) ? data : [];
            setStudents(studentsData);

            if (params?.admissionNo) {
                const targetStudent = studentsData.find((student) => String(student.admissionNo) === String(params.admissionNo));
                if (targetStudent) {
                    setSelectedStudent(targetStudent);
                }
            } else {
                setSelectedStudent((current) => (
                    current
                        ? studentsData.find((student) => String(student.admissionNo) === String(current.admissionNo)) || current
                        : current
                ));
            }
        } catch {
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, [academicYear, params?.admissionNo, user?._id]);

    const fetchStudentIncidents = useCallback(async (student, options = { reset: false }) => {
        if (!user?._id || !student) return;
        if (!academicYear) return;
        try {
            setLoading(true);
            const config = {};
            const params = buildIncidentFilterParams({
                dateRange: options?.reset ? { start: '', end: '' } : { start: dateRange.start, end: dateRange.end },
                statuses: options?.reset ? [] : statusFilter,
                types: options?.reset ? [] : filters.incidentTypes,
                locations: options?.reset ? [] : filters.locations,
                evidenceTypes: options?.reset ? [] : filters.evidence,
                students: student?.admissionNo ? [] : student?.name ? [student.name] : [],
                admissionNos: student?.admissionNo ? [student.admissionNo] : [],
            });
            if (!options?.reset && academicYear) params.set('academicYear', academicYear);

            const requestConfig = params.toString() ? { ...config, params } : config;
            const { data } = await apiClient.get('/api/incidents', requestConfig);
            setStudentIncidents(Array.isArray(data) ? data : []);
        } catch {
            setStudentIncidents([]);
        } finally {
            setLoading(false);
        }
    }, [academicYear, dateRange, filters.evidence, filters.incidentTypes, filters.locations, statusFilter, user?._id]);

    const fetchStudentLocationDistribution = useCallback(async (student, options = { reset: false }) => {
        if (!user?._id || !student) {
            setLocationDistribution([]);
            return;
        }
        if (!academicYear) return;

        try {
            const config = {};
            const params = buildIncidentFilterParams({
                dateRange: options?.reset ? { start: '', end: '' } : { start: dateRange.start, end: dateRange.end },
                statuses: options?.reset ? [] : statusFilter,
                types: options?.reset ? [] : filters.incidentTypes,
                locations: options?.reset ? [] : filters.locations,
                evidenceTypes: options?.reset ? [] : filters.evidence,
                students: student?.admissionNo ? [] : student?.name ? [student.name] : [],
                admissionNos: student?.admissionNo ? [student.admissionNo] : [],
            });
            if (!options?.reset && academicYear) params.set('academicYear', academicYear);

            const requestConfig = params.toString() ? { ...config, params } : config;
            const { data } = await apiClient.get('/api/incidents/location-distribution', requestConfig);
            setLocationDistribution(Array.isArray(data) ? data : []);
        } catch {
            setLocationDistribution([]);
        }
    }, [academicYear, dateRange.end, dateRange.start, filters.evidence, filters.incidentTypes, filters.locations, statusFilter, user?._id]);

    const fetchStudentLetters = useCallback(async (student, options = { reset: false }) => {
        if (!user?._id || !student?.admissionNo) return;
        if (!academicYear) return;
        try {
            setLettersLoading(true);
            const config = {};
            const params = buildIssuedLetterFilterParams({
                dateRange: options?.reset ? { start: '', end: '' } : { start: dateRange.start, end: dateRange.end },
            });
            if (!options?.reset && academicYear) params.set('academicYear', academicYear);
            const requestConfig = params.toString() ? { ...config, params } : config;
            const { data } = await apiClient.get(`/api/issued-letters/student/${student.admissionNo}`, requestConfig);
            setStudentLetters(Array.isArray(data) ? data : []);
        } catch {
            setStudentLetters([]);
        } finally {
            setLettersLoading(false);
        }
    }, [academicYear, dateRange, user?._id]);

    const fetchLetterStatusForIncidents = useCallback(async (incidents) => {
        if (!user?._id || !incidents || incidents.length === 0) return;
        try {
            const incidentIds = incidents.map((incident) => incident._id || incident.id).filter(Boolean);
            const config = {};
            const { data } = await apiClient.post(
                '/api/issued-letters/status/batch',
                { incidentIds },
                config
            );
            setLetterStatusMap(data || {});
        } catch {
            setLetterStatusMap({});
        }
    }, [user?._id]);

    useEffect(() => {
        fetchFilterOptions();
        fetchStudents();
    }, [fetchFilterOptions, fetchStudents]);

    useEffect(() => {
        if (selectedStudent) {
            fetchStudentIncidents(selectedStudent);
            fetchStudentLetters(selectedStudent);
        }
    }, [academicYear, dateRange.end, dateRange.start, fetchStudentIncidents, fetchStudentLetters, filters.evidence, filters.incidentTypes, filters.locations, selectedStudent, statusFilter, user?._id]);

    useEffect(() => {
        if (selectedStudent) {
            fetchStudentLocationDistribution(selectedStudent);
        } else {
            setLocationDistribution([]);
        }
    }, [academicYear, dateRange.end, dateRange.start, fetchStudentLocationDistribution, filters.evidence, filters.incidentTypes, filters.locations, selectedStudent, statusFilter, user?._id]);

    useEffect(() => {
        if (studentIncidents.length > 0) {
            fetchLetterStatusForIncidents(studentIncidents);
        }
    }, [fetchLetterStatusForIncidents, studentIncidents]);

    const filteredIncidentSet = useMemo(() => (selectedStudent ? studentIncidents : []), [selectedStudent, studentIncidents]);
    const locationFilterOptions = useMemo(
        () => withUnknownOption(filterOptions.locations, hasUnknownLocation(studentIncidents) || filters.locations.includes('Unknown')),
        [filterOptions.locations, filters.locations, studentIncidents]
    );
    const evidenceFilterOptions = useMemo(
        () => withUnknownOption(filterOptions.evidence, hasUnknownEvidenceType(studentIncidents) || filters.evidence.includes('Unknown')),
        [filterOptions.evidence, filters.evidence, studentIncidents]
    );

    const studentAnalytics = useMemo(() => {
        const total = filteredIncidentSet.length;
        const open = filteredIncidentSet.filter((incident) => incident.status === 'Open').length;
        const inProgress = filteredIncidentSet.filter((incident) => incident.status === 'In Progress').length;
        const closed = filteredIncidentSet.filter((incident) => incident.status === 'Closed').length;

        const incidentDetails = filteredIncidentSet.map((incident) => ({
            ...incident,
            reportedBy: incident.reportedBy?.name || 'Unknown',
            assignedHandler: incident.assignedHandler?.name || 'Unassigned',
        }));

        const generatedLetters = incidentDetails.filter((incident) => {
            const incidentId = incident._id || incident.id;
            return Boolean(letterStatusMap[incidentId]?.hasLetter);
        }).length;
        const pendingLetters = Math.max(total - generatedLetters, 0);

        return {
            total,
            open,
            inProgress,
            closed,
            generatedLetters,
            pendingLetters,
            incidentDetails,
            statusData: [
                { name: 'Open', value: open, color: STATUS_COLORS.Open },
                { name: 'In Progress', value: inProgress, color: STATUS_COLORS['In Progress'] },
                { name: 'Closed', value: closed, color: STATUS_COLORS.Closed },
            ],
            letterSummaryData: [
                { name: 'Generated', value: generatedLetters, color: '#10b981' },
                { name: 'Pending', value: pendingLetters, color: CHART_COLORS.pending },
            ],
            categoryData: buildDistribution(filteredIncidentSet, (incident) => incident.category || 'Uncategorized', 'category'),
            locationData: locationDistribution,
            evidenceData: buildEvidenceDistribution(filteredIncidentSet),
            statusTrendData: buildStatusTrendSeries({
                items: filteredIncidentSet,
                dateRange,
                fallbackDays: 14,
            }),
            creationTrendData: buildCreationTrendSeries({
                items: filteredIncidentSet,
                dateRange,
                fallbackDays: 14,
            }),
        };
    }, [dateRange, filteredIncidentSet, letterStatusMap, locationDistribution]);

    const filteredStudentLetters = useMemo(() => {
        if (!studentLetters) return [];

        return studentLetters.filter((letter) => {
            const timelineTimestamp = getLetterTimelineTimestamp(letter);
            const letterDate = timelineTimestamp ? normalizeToStartOfDay(timelineTimestamp) : null;
            const start = dateRange.start ? normalizeToStartOfDay(dateRange.start) : null;
            const end = dateRange.end ? normalizeToStartOfDay(dateRange.end) : null;
            const matchesStart = start === null || (letterDate !== null && letterDate >= start);
            const matchesEnd = end === null || (letterDate !== null && letterDate <= end);
            const isCategoryAllSelected = filters.incidentTypes.length === 0;
            const matchesCategory = isCategoryAllSelected || filters.incidentTypes.includes(letter.incidentCategory);
            return matchesStart && matchesEnd && matchesCategory;
        });
    }, [dateRange.end, dateRange.start, filters.incidentTypes, studentLetters]);

    const handleDownloadLetterDocx = async (letter) => {
        if (!user?._id) return;
        setDownloadingLetterId(letter._id);
        try {
            const response = await apiClient.get(`/api/issued-letters/${letter._id}/download`, {
                headers: {},
                responseType: 'blob',
            });
            await withFeedback(
                addToast,
                () => downloadBlob(
                    new Blob([response.data], {
                        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    }),
                    `LET_${slugify(letter.className || 'Class')}_${slugify(letter.section || 'S')}_${slugify(letter.studentName || 'Student')}_${slugify(letter.admissionNo || '00000')}.docx`,
                    { title: 'Issued letter' }
                ),
                {
                    successMessage: 'Letter downloaded successfully.',
                    errorMessage: 'Download failed.',
                }
            );
        } catch {
        } finally {
            setDownloadingLetterId(null);
        }
    };

    const exportIncidentTimelineToExcel = async () => {
        try {
            const excelData = studentAnalytics.incidentDetails.map((incident) => {
            const incidentId = incident._id || incident.id;
            const letterInfo = letterStatusMap[incidentId] || {};
            return {
                'Student Name': selectedStudent?.name || 'N/A',
                'Admission Number': selectedStudent?.admissionNo || 'N/A',
                Category: incident.category || 'N/A',
                Location: incident.location || 'N/A',
                Evidence: (incident.evidence || []).map((entry) => entry?.evidenceType).filter(Boolean).join(', ') || 'None',
                Reporter: incident.reportedBy,
                Handler: incident.assignedHandler,
                Status: incident.status || 'N/A',
                Opened: formatShortDate(getIncidentTimestamp(incident)),
                Closed: formatShortDate(incident.closedAt),
                Letter: letterInfo.hasLetter ? 'Issued' : 'Not Issued',
            };
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Incident Timeline');
        await withFeedback(
            addToast,
            () => downloadWorkbook(
                XLSX,
                wb,
                `Incident_Report_${slugify(selectedStudent?.name || 'Student')}_${new Date().toISOString().split('T')[0]}.xlsx`,
                { title: 'Incident report' }
            ),
            {
                successMessage: 'Excel exported successfully.',
                errorMessage: 'Export failed.',
            }
        );
        } catch {
        }
    };

    if (loading && !selectedStudent) {
        return (
            <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
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

    const incidentColumns = [
        { key: 'category', label: 'Type', render: (row) => row.category || 'N/A' },
        { key: 'location', label: 'Location', render: (row) => row.location || 'N/A' },
        {
            key: 'evidence',
            label: 'Evidence',
            render: (row) =>
                row.evidence && row.evidence.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {row.evidence.map((entry, index) => (
                            <span key={`${row._id}-ev-${index}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                                {entry.evidenceType || 'Evidence'}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-xs text-slate-400">None</span>
                ),
        },
        { key: 'reporter', label: 'Reporter', render: (row) => row.reportedBy },
        { key: 'handler', label: 'Handler', render: (row) => row.assignedHandler },
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

    const letterColumns = [
        { key: 'letterNumber', label: 'Letter #', render: (row) => <span className="font-mono text-xs text-slate-600">{row.letterNumber}</span> },
        { key: 'templateName', label: 'Letter name', render: (row) => row.templateName || row.title || 'Official letter' },
        { key: 'incidentCategory', label: 'Category', render: (row) => row.incidentCategory || 'N/A' },
        { key: 'generatedAt', label: 'Date Issued', render: (row) => formatShortDate(row.generatedAt) },
        {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleDownloadLetterDocx(row)}
                        disabled={downloadingLetterId === row._id}
                        className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100 disabled:opacity-60"
                        title="Download Word file"
                    >
                        {downloadingLetterId === row._id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    </button>
                </div>
            ),
        },
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

    const letterSummaryColumns = [
        { key: 'name', label: 'Letter Status' },
        { key: 'value', label: 'Count' },
        { key: 'share', label: 'Share' },
    ];

    const categoryColumns = [
        { key: 'category', label: 'Category' },
        { key: 'count', label: 'Incidents' },
    ];

    const locationColumns = [
        { key: 'location', label: 'Location' },
        { key: 'count', label: 'Incidents' },
    ];

    const evidenceColumns = [
        { key: 'name', label: 'Evidence Type' },
        { key: 'count', label: 'Count' },
    ];

    const letterSummaryRows = studentAnalytics.letterSummaryData.map((entry) => ({
        ...entry,
        share: formatShare(entry.value, studentAnalytics.total),
    }));

    return (
        <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
            <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-6">
                        {!selectedStudent ? (
                            <>
                                <DashboardHero
                                    eyebrow="Student summaries"
                                    title="Student directory"
                                    description="View student records and incident history."
                                    icon={Users}
                                    meta={
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                                {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'} in current result
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                                {filterOptions.classes.length} classes in use
                                            </span>
                                        </div>
                                    }
                                />

                                <UnifiedFilterBar
                                    hasActiveFilters={Boolean(searchTerm) || Boolean(classFilter) || Boolean(sectionFilter)}
                                    onReset={() => {
                                        setSearchTerm('');
                                        setClassFilter('');
                                        setSectionFilter('');
                                    }}
                                    title="Find a student"
                                    collapsible
                                    defaultCollapsed
                                >
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(event) => setSearchTerm(event.target.value)}
                                                    placeholder="Name or admission number…"
                                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 focus-visible:outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Class</label>
                                            <select
                                                value={classFilter}
                                                onChange={(event) => setClassFilter(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 focus-visible:outline-none"
                                            >
                                                <option value="">All Classes</option>
                                                {filterOptions.classes.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Section</label>
                                            <select
                                                value={sectionFilter}
                                                onChange={(event) => setSectionFilter(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 focus-visible:outline-none"
                                            >
                                                <option value="">All Sections</option>
                                                {filterOptions.sections.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </UnifiedFilterBar>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <DashboardStatCard title="Total Students" value={students.length} icon={Users} tone="blue" helper="Directory population" />
                                    <DashboardStatCard title="Showing now" value={filteredStudents.length} icon={Search} tone="cyan" helper="Matching your filters" />
                                    <DashboardStatCard title="Classes" value={filterOptions.classes.length} icon={TrendingUp} tone="slate" helper="Available class groups" />
                                    <DashboardStatCard title="Sections" value={filterOptions.sections.length} icon={ShieldCheck} tone="slate" helper="Available section groups" />
                                </div>

                                {filteredStudents.length === 0 ? (
                                    <EmptyStatePanel
                                        title="No students found"
                                        description={searchTerm || classFilter || sectionFilter ? 'Try broadening your filters to surface more students.' : 'No students are currently available in the directory.'}
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        {filteredStudents.map((student) => (
                                            <button
                                                key={student._id}
                                                type="button"
                                                onClick={() => setSelectedStudent(student)}
                                                className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-lg font-bold text-blue-700">
                                                        {student?.name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold text-slate-900">{student?.name || 'Unknown Student'}</p>
                                                        <p className="truncate text-xs font-medium text-slate-500">{student?.admissionNo || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Class {student?.className || 'N/A'}</span>
                                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Section {student?.section || 'N/A'}</span>
                                                </div>
                                                <div className="mt-4 border-t border-slate-100 pt-4 text-sm font-semibold text-blue-700">
                                                    View summary & history
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <DashboardHero
                                    eyebrow="Student summary"
                                    title={selectedStudent?.name || 'Student summary'}
                                    description="View student incidents and letters."
                                    icon={TrendingUp}
                                    actions={
                                        <button
                                            onClick={() => {
                                                setSelectedStudent(null);
                                                setStudentIncidents([]);
                                                setStudentLetters([]);
                                            }}
                                            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                                        >
                                            <ArrowLeft size={16} className="mr-2 inline" aria-hidden="true" />
                                            Back to Directory
                                        </button>
                                    }
                                />

                                <UnifiedFilterBar
                                    hasActiveFilters={
                                        filters.incidentTypes.length > 0 ||
                                        filters.locations.length > 0 ||
                                        filters.evidence.length > 0 ||
                                        statusFilter.length > 0 ||
                                        academicYear !== currentAcademicYear ||
                                        Boolean(dateRange.start) ||
                                        Boolean(dateRange.end)
                                    }
                                    onReset={() => {
                                        setFilters({ incidentTypes: [], locations: [], evidence: [] });
                                        setStatusFilter([]);
                                        setDateRange({ start: '', end: '' });
                                        setAcademicYear(currentAcademicYear);
                                    }}
                                    title="Student Filters"
                                    collapsible
                                    defaultCollapsed
                                >
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
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
                                            selected={statusFilter}
                                            onChange={setStatusFilter}
                                            placeholder="All Status"
                                            searchPlaceholder="Search status..."
                                        />
                                    </div>
                                </UnifiedFilterBar>

                                {loading && studentIncidents.length === 0 ? (
                                    <DashboardPageSkeleton showHero={false} />
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                                            <DashboardStatCard title="Total Incidents" value={studentAnalytics.total} icon={FileText} tone="blue" helper="All filtered incidents" />
                                            <DashboardStatCard title="Open" value={studentAnalytics.open} icon={AlertTriangle} tone="amber" helper="Needs attention" />
                                            <DashboardStatCard title="In Progress" value={studentAnalytics.inProgress} icon={Clock} tone="blue" helper="Currently being handled" />
                                            <DashboardStatCard title="Closed" value={studentAnalytics.closed} icon={CheckCircle} tone="emerald" helper="Resolved cases" />
                                            <DashboardStatCard title="Letters sent" value={studentAnalytics.generatedLetters} icon={Mail} tone="emerald" helper="Letters completed for this student" />
                                            <DashboardStatCard title="Letters Pending" value={studentAnalytics.pendingLetters} icon={ShieldCheck} tone="amber" helper="Incident cases without letters" />
                                        </div>

                                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                                            <DashboardWidgetPanel
                                                className="xl:col-span-8"
                                                title="Incident Status Over Time"
                                                description="Daily open, in-progress, and closed counts using the incident timeline date."
                                                icon={TrendingUp}
                                                chart={<IncidentStatusTrendChart data={studentAnalytics.statusTrendData} idPrefix="student-status" />}
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
                                                tableRows={studentAnalytics.statusTrendData}
                                                emptyMessage="No status trend data is available for the current filters."
                                            />

                                            <DashboardWidgetPanel
                                                className="xl:col-span-4"
                                                title="New Incidents by Day"
                                                description="New incidents per day based on the timeline date."
                                                icon={AlertTriangle}
                                                chart={<DailyCreationTrendChart data={studentAnalytics.creationTrendData} />}
                                                tableColumns={creationTrendColumns}
                                                tableRows={studentAnalytics.creationTrendData}
                                                emptyMessage="No creation trend data is available for the current filters."
                                            />

                                            <DashboardWidgetPanel
                                                className="xl:col-span-4"
                                                title="Letter Status"
                                                description="Letters generated versus letters still pending for this student."
                                                icon={Mail}
                                                chart={
                                                    <ChartSurface height={240}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                        <PieChart>
                                                            <Pie
                                                                data={studentAnalytics.letterSummaryData}
                                                                dataKey="value"
                                                                nameKey="name"
                                                                innerRadius={62}
                                                                outerRadius={92}
                                                                paddingAngle={4}
                                                            >
                                                                {studentAnalytics.letterSummaryData.map((entry) => (
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
                                                        items={studentAnalytics.letterSummaryData.map((entry) => ({
                                                            label: entry.name,
                                                            value: entry.value,
                                                            color: entry.color,
                                                        }))}
                                                    />
                                                }
                                                tableColumns={letterSummaryColumns}
                                                tableRows={letterSummaryRows}
                                                emptyMessage="No letter issuance data is available for the current filters."
                                            />

                                            <DashboardWidgetPanel
                                                className="xl:col-span-4"
                                                title="Where Incidents Occurred"
                                                description="Number of incidents recorded at each school location."
                                                icon={ShieldCheck}
                                                chart={
                                                    <ChartSurface height={280}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                        <BarChart data={studentAnalytics.locationData.slice(0, 6)} layout="vertical" margin={{ top: 10, right: 24, left: 8, bottom: 0 }}>
                                                            <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" horizontal={false} />
                                                            <XAxis type="number" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                            <YAxis dataKey="location" type="category" width={compactChart ? 118 : 96} axisLine={false} tickLine={false} {...compactYAxisProps} />
                                                            <ChartTooltip />
                                                            <Bar dataKey="count" fill={CHART_COLORS.location} radius={[0, 8, 8, 0]} name="Incidents">
                                                                <LabelList dataKey="count" position="right" fill={CHART_THEME.label} fontSize={12} />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>

                                                    </ChartSurface>
                                                }
                                                footer={
                                                    <LegendList
                                                        items={studentAnalytics.locationData.slice(0, 4).map((entry) => ({
                                                            label: entry.location,
                                                            value: entry.count,
                                                            color: CHART_COLORS.location,
                                                        }))}
                                                    />
                                                }
                                                tableColumns={locationColumns}
                                                tableRows={studentAnalytics.locationData}
                                                emptyMessage="No location data is available for the current filters."
                                            />

                                            <DashboardWidgetPanel
                                                className="xl:col-span-4"
                                                title="Incidents by Type"
                                                description="Most frequent incident categories involving this student."
                                                icon={FileText}
                                                chart={
                                                    <ChartSurface height={280}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                        <BarChart data={studentAnalytics.categoryData.slice(0, 6)} margin={horizontalBarMargin}>
                                                            <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                            <XAxis dataKey="category" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                            <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                            <ChartTooltip />
                                                            <Bar dataKey="count" fill={CHART_COLORS.category} radius={[6, 6, 0, 0]} name="Incidents">
                                                                <LabelList dataKey="count" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>

                                                    </ChartSurface>
                                                }
                                                tableColumns={categoryColumns}
                                                tableRows={studentAnalytics.categoryData}
                                                emptyMessage="No category data is available for the current filters."
                                            />

                                            <DashboardWidgetPanel
                                                className="xl:col-span-12"
                                                title="Evidence Records"
                                                description="Types of evidence captured across this student's incident history."
                                                icon={ShieldCheck}
                                                chart={
                                                    studentAnalytics.evidenceData.length === 0 ? (
                                                        <EmptyStatePanel title="No evidence distribution" description="There are no evidence records for the current filters." />
                                                    ) : (
                                                        <ChartSurface height={280}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                            <BarChart data={studentAnalytics.evidenceData.slice(0, 8)} margin={horizontalBarMargin}>
                                                                <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                                <XAxis dataKey="name" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                                <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                                <ChartTooltip />
                                                                <Bar dataKey="count" fill={CHART_COLORS.evidence} radius={[6, 6, 0, 0]} name="Evidence Count">
                                                                    <LabelList dataKey="count" position="top" fill={CHART_THEME.label} fontSize={12} />
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>

                                                        </ChartSurface>
                                                    )
                                                }
                                                footer={
                                                    studentAnalytics.evidenceData.length > 0 ? (
                                                        <LegendList
                                                            items={studentAnalytics.evidenceData.slice(0, 6).map((entry, index) => ({
                                                                label: entry.name,
                                                                value: entry.count,
                                                                color: [CHART_COLORS.evidence, CHART_COLORS.category, STATUS_COLORS.Closed, STATUS_COLORS.Open, CHART_COLORS.location, STATUS_COLORS['In Progress']][index % 6],
                                                            }))}
                                                        />
                                                    ) : null
                                                }
                                                tableColumns={evidenceColumns}
                                                tableRows={studentAnalytics.evidenceData}
                                                emptyMessage="No evidence data is available for the current filters."
                                            />
                                        </div>

                                        <DashboardPanel
                                            title="Incident History"
                                            description="Detailed incident records for this student."
                                            icon={FileText}
                                            actions={
                                                <button
                                                    type="button"
                                                    onClick={exportIncidentTimelineToExcel}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                                >
                                                    <Download size={14} aria-hidden="true" />
                                                    Export
                                                </button>
                                            }
                                        >
                                            <AnalyticsDataTable
                                                columns={incidentColumns}
                                                rows={studentAnalytics.incidentDetails}
                                                emptyMessage="No incidents match the current filters."
                                            />
                                        </DashboardPanel>

                                        <DashboardPanel
                                            title="Letters Issued"
                                            description={`${filteredStudentLetters.length} letter${filteredStudentLetters.length === 1 ? '' : 's'} in the current view.`}
                                            icon={Mail}
                                        >
                                            {lettersLoading ? (
                                                <div className="flex items-center justify-center py-12">
                                                    <Loader2 size={24} className="animate-spin text-blue-600" />
                                                </div>
                                            ) : filteredStudentLetters.length === 0 ? (
                                                <EmptyStatePanel
                                                    title="No letters found"
                                                    description="No letters match the current filters or no letters have been issued yet."
                                                />
                                            ) : (
                                                <AnalyticsDataTable columns={letterColumns} rows={filteredStudentLetters} emptyMessage="No letters found." />
                                            )}
                                        </DashboardPanel>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default StudentAnalytics;
