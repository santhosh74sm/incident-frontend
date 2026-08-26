import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../config/apiClient';
import { useMasterDataListener } from '../hooks/useMasterDataListener';
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
    Eye,
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
    buildManagementReportWorksheet,
    buildEvidenceDistribution,
    buildIncidentFilterParams,
    buildIssuedLetterFilterParams,
    buildStatusTrendSeries,
    CHART_COLORS,
    formatProgressLogForExport,
    formatShortDate,
    getIncidentTimestamp,
    getLetterTimelineTimestamp,
    hasUnknownEvidenceType,
    hasUnknownLocation,
    normalizeOptionList,
    normalizeToStartOfDay,
    resolveIncidentPriorityForExport,
    STATUS_COLORS,
    STATUS_OPTIONS,
    toneForStatus,
    withUnknownOption,
    formatDisplayValue,
    resolveUserLabel,
    getFilteredSections,
    getIncidentOpenedTimestamp,
    sortIncidentsChronologically,
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
    const mainScrollContainerRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [activeSummaryTab, setActiveSummaryTab] = useState('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [sectionFilter, setSectionFilter] = useState('');
    const [studentSummarySort, setStudentSummarySort] = useState({ key: 'name', direction: 'asc' });
    const [studentSummaryPage, setStudentSummaryPage] = useState(1);
    const [studentRowsPerPage, setStudentRowsPerPage] = useState(10);
    const [studentDirectorySummary, setStudentDirectorySummary] = useState({ total: 0, incidentCount: 0, letterCount: 0 });
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
        classSectionMap: {},
        incidentTypes: [],
        locations: [],
        evidence: [],
    });

    const filteredSections = useMemo(() => {
        return getFilteredSections(classFilter, filterOptions.sections, filterOptions.classSectionMap);
    }, [classFilter, filterOptions.sections, filterOptions.classSectionMap]);

    useEffect(() => {
        if (sectionFilter) {
            const validSections = getFilteredSections(classFilter, filterOptions.sections, filterOptions.classSectionMap);
            if (!validSections.includes(sectionFilter)) {
                setSectionFilter('');
            }
        }
    }, [classFilter, filterOptions.sections, filterOptions.classSectionMap, sectionFilter]);
    const [studentLetters, setStudentLetters] = useState([]);
    const [lettersLoading, setLettersLoading] = useState(false);
    const [downloadingLetterId, setDownloadingLetterId] = useState(null);
    const [letterStatusMap, setLetterStatusMap] = useState({});
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [academicYear, setAcademicYear] = useState('');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const [academicYears, setAcademicYears] = useState([]);
    const [locationDistribution, setLocationDistribution] = useState([]);
    const studentDirectoryRequestRef = useRef(0);
    const filterMetadataRef = useRef({ userId: '', data: null });
    const hasLoadedStudentsRef = useRef(false);
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
    const studentStatus = activeSummaryTab === 'passedOut' ? 'Passed Out' : 'Active';
    const isPassedOutSummary = activeSummaryTab === 'passedOut';

    const studentSummaryPageSize = 100;
    const filteredStudents = students;
    const studentVisibleTotal = filteredStudents.length;
    const studentSummaryTotalPages = Math.max(1, Math.ceil(studentVisibleTotal / studentRowsPerPage));
    const normalizedStudentPage = Math.min(studentSummaryPage, studentSummaryTotalPages);
    const studentPageStartIndex = (normalizedStudentPage - 1) * studentRowsPerPage;
    const paginatedStudents = filteredStudents.slice(studentPageStartIndex, studentPageStartIndex + studentRowsPerPage);

    const fetchFilterOptions = useCallback(async () => {
        if (!user?._id) return;
        try {
            const config = academicYear ? { params: { academicYear, status: studentStatus } } : { params: { status: studentStatus } };
            const staticConfig = {};
            let metadata = filterMetadataRef.current;
            if (metadata.userId !== user._id || !metadata.data) {
                const [categoriesRes, locationsRes, evidenceRes, yearsRes] = await Promise.all([
                    apiClient.get('/api/incidents/categories', staticConfig).catch(() => ({ data: [] })),
                    apiClient.get('/api/incidents/locations', { ...staticConfig, params: { includeUnknown: true } }).catch(() => ({ data: [] })),
                    apiClient.get('/api/evidence-types', { ...staticConfig, params: { includeUnknown: true } }).catch(() => ({ data: [] })),
                    apiClient.get('/api/auth/academic-years', staticConfig).catch(() => ({ data: {} })),
                ]);
                metadata = {
                    userId: user._id,
                    data: { categoriesRes, locationsRes, evidenceRes, yearsRes },
                };
                filterMetadataRef.current = metadata;
            }

            const studentsRes = await apiClient.get('/api/students/filters', config).catch(() => ({ data: {} }));
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
    }, [academicYear, studentStatus, user?._id]);

    const fetchStudents = useCallback(async () => {
        if (!user?._id) return;
        const requestId = studentDirectoryRequestRef.current + 1;
        studentDirectoryRequestRef.current = requestId;
        const isCurrentRequest = () => studentDirectoryRequestRef.current === requestId;
        const attachStableId = (student) => ({
            ...student,
            id: `${student._id || student.admissionNo}-${student.academicYear || academicYear}`,
        });
        const syncSelectedStudent = (studentsData) => {
            if (params?.admissionNo) {
                const targetStudent = studentsData.find((student) => String(student.admissionNo) === String(params.admissionNo));
                if (targetStudent) {
                    setSelectedStudent(targetStudent);
                }
                return;
            }
            setSelectedStudent((current) => (
                current
                    ? studentsData.find((student) => String(student.admissionNo) === String(current.admissionNo)) || current
                    : current
            ));
        };
        try {
            setLoading(true);
            if (!academicYear) return;
            const baseParams = {
                academicYear,
                status: studentStatus,
                includeSummaryCounts: true,
                limit: studentSummaryPageSize,
                ...(params?.admissionNo ? { search: params.admissionNo } : debouncedSearchTerm ? { search: debouncedSearchTerm } : {}),
                ...(classFilter ? { className: classFilter } : {}),
                ...(sectionFilter ? { section: sectionFilter } : {}),
                sortBy: studentSummarySort.key,
                sortDirection: studentSummarySort.direction,
            };
            const firstResponse = await apiClient.get('/api/students', { params: { ...baseParams, page: 1 } });
            if (!isCurrentRequest()) return;

            const firstPageStudents = Array.isArray(firstResponse.data?.data) ? firstResponse.data.data : [];
            const pagination = firstResponse.data?.pagination || { page: 1, total: firstPageStudents.length, totalPages: 1 };
            setStudents(firstPageStudents.map(attachStableId));
            setStudentDirectorySummary(firstResponse.data?.summary || { total: firstPageStudents.length, incidentCount: 0, letterCount: 0 });
            syncSelectedStudent(firstPageStudents);
            setLoading(false);

            const totalPages = pagination.totalPages || 1;
            if (totalPages <= 1) return;

            const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
            const remainingResponses = await Promise.all(
                remainingPages.map((page) => (
                    apiClient.get('/api/students', { params: { ...baseParams, page } })
                        .catch(() => ({ data: { data: [] } }))
                ))
            );
            if (!isCurrentRequest()) return;

            const remainingStudents = remainingResponses.flatMap(({ data }) => (
                Array.isArray(data?.data) ? data.data : []
            ));
            const studentsData = [...firstPageStudents, ...remainingStudents];
            setStudents(studentsData.map(attachStableId));
            syncSelectedStudent(studentsData);
        } catch {
            if (isCurrentRequest()) {
                setStudents([]);
            }
        } finally {
            if (isCurrentRequest()) {
                if (academicYear) hasLoadedStudentsRef.current = true;
                setLoading(false);
            }
        }
    }, [academicYear, classFilter, debouncedSearchTerm, params?.admissionNo, sectionFilter, studentStatus, studentSummarySort.direction, studentSummarySort.key, user?._id]);

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

    useMasterDataListener(useCallback(() => {
        filterMetadataRef.current = { userId: '', data: null };
        fetchFilterOptions();
        fetchStudents();
    }, [fetchFilterOptions, fetchStudents]));

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchTerm(searchTerm.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setStudentSummaryPage(1);
    }, [academicYear, classFilter, debouncedSearchTerm, sectionFilter, studentRowsPerPage, studentStatus, studentSummarySort.direction, studentSummarySort.key]);

    useEffect(() => {
        if (studentSummaryPage > studentSummaryTotalPages) {
            setStudentSummaryPage(studentSummaryTotalPages);
        }
    }, [studentSummaryPage, studentSummaryTotalPages]);

    useEffect(() => {
        if (selectedStudent) {
            Promise.all([
                fetchStudentIncidents(selectedStudent),
                fetchStudentLetters(selectedStudent),
                fetchStudentLocationDistribution(selectedStudent),
            ]);
        } else {
            setLocationDistribution([]);
            setStudentIncidents([]);
            setStudentLetters([]);
        }
    }, [academicYear, dateRange.end, dateRange.start, fetchStudentIncidents, fetchStudentLetters, fetchStudentLocationDistribution, filters.evidence, filters.incidentTypes, filters.locations, selectedStudent, statusFilter, user?._id]);

    useEffect(() => {
        if (studentIncidents.length > 0) {
            fetchLetterStatusForIncidents(studentIncidents);
        }
    }, [fetchLetterStatusForIncidents, studentIncidents]);

    useEffect(() => {
        if (mainScrollContainerRef.current) {
            mainScrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [selectedStudent]);

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
        const pending = filteredIncidentSet.filter((incident) => incident.status === 'Pending' || incident.status === 'Open' || incident.status === 'In Progress').length;
        const closed = filteredIncidentSet.filter((incident) => incident.status === 'Closed').length;

        const sortedIncidents = [...filteredIncidentSet].sort(sortIncidentsChronologically);
        const incidentDetails = sortedIncidents.map((incident) => ({
            ...incident,
            reportedBy: resolveUserLabel(incident.reportedBy, 'Unknown'),
            assignedHandler: resolveUserLabel(incident.assignedHandler, 'Unassigned'),
        }));

        const generatedLetters = incidentDetails.filter((incident) => {
            const incidentId = incident._id || incident.id;
            return Boolean(letterStatusMap[incidentId]?.hasLetter);
        }).length;
        const pendingLetters = Math.max(total - generatedLetters, 0);

        return {
            total,
            pending,
            open: pending,
            inProgress: 0,
            closed,
            generatedLetters,
            pendingLetters,
            incidentDetails,
            statusData: [
                { name: 'Pending', value: pending, color: STATUS_COLORS.Pending },
                { name: 'Closed', value: closed, color: STATUS_COLORS.Closed },
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
                    { title: 'Issued Letter' }
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
                Description: incident.description || '',
                Priority: resolveIncidentPriorityForExport(incident),
                'Progress Log': formatProgressLogForExport(incident.progressLogs),
                Location: incident.location || 'N/A',
                Evidence: (incident.evidence || []).map((entry) => entry?.evidenceType).filter(Boolean).join(', ') || 'None',
                Reporter: incident.reportedBy,
                Handler: incident.assignedHandler,
                Status: incident.status || 'N/A',
                Opened: formatShortDate(getIncidentTimestamp(incident)),
                Closed: formatShortDate(incident.closedAt),
                Letter: letterInfo.hasLetter ? 'Issued' : 'Not issued',
            };
        });

        const exportColumns = ['Student Name', 'Admission Number', 'Category', 'Description', 'Priority', 'Progress Log', 'Location', 'Evidence', 'Reporter', 'Handler', 'Status', 'Opened', 'Closed', 'Letter'];
        const wb = XLSX.utils.book_new();
        const generatedAt = new Date();
        const exportDate = generatedAt.toISOString().split('T')[0];
        const ws = buildManagementReportWorksheet(XLSX, {
            reportTitle: 'Student Analytics Report',
            generatedBy: user?.name || user?.email || 'Unknown',
            generatedOn: generatedAt,
            academicYear: academicYear || currentAcademicYear || 'All years',
            contextRows: [
                ['Student:', selectedStudent?.name || 'N/A'],
                ['Admission Number:', selectedStudent?.admissionNo || 'N/A'],
            ],
            appliedFilters: [
                { label: 'Date Range', value: dateRange.start || dateRange.end ? `${dateRange.start || 'Any'} to ${dateRange.end || 'Any'}` : '' },
                { label: 'Category', value: filters.incidentTypes },
                { label: 'Location', value: filters.locations },
                { label: 'Evidence Type', value: filters.evidence },
                { label: 'Status', value: statusFilter },
            ],
            totalRecords: studentAnalytics.incidentDetails.length,
            columns: exportColumns,
            rows: excelData,
        });
        XLSX.utils.book_append_sheet(wb, ws, 'Incident Timeline');
        await withFeedback(
            addToast,
            () => downloadWorkbook(
                XLSX,
                wb,
                `Student_Incident_Timeline_${slugify(selectedStudent?.name || 'Student')}_${slugify(academicYear || currentAcademicYear || 'All_Years')}_${exportDate}.xlsx`,
                { title: 'Incident Report' }
            ),
            {
                successMessage: 'Excel exported successfully.',
                errorMessage: 'Export failed.',
            }
        );
        } catch {
        }
    };

    const buildStudentSummaryRows = (sourceStudents = filteredStudents) =>
        sourceStudents.map((student) => ({
            'Admission Number': student?.admissionNo || 'N/A',
            'Student Name': student?.name || 'N/A',
            Class: student?.className || 'N/A',
            Section: student?.section || 'N/A',
            'Academic Year': student?.academicYear || academicYear || 'N/A',
            Status: student?.status || studentStatus,
            'Incident Count': student?.incidentCount || 0,
            'Letter Count': student?.letterCount || 0,
        }));

    const toggleStudentSummarySort = (key) => {
        setStudentSummarySort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const renderSortLabel = (key, label) => (
        <button
            type="button"
            onClick={() => toggleStudentSummarySort(key)}
            className="inline-flex items-center gap-1 font-semibold text-slate-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 "
            aria-label={`Sort by ${label}`}
        >
            {label}
            <span className="text-[10px]">{studentSummarySort.key === key ? (studentSummarySort.direction === 'asc' ? '^' : 'v') : '-'}</span>
        </button>
    );

    const openStudentSummary = (student) => {
        if (student?.academicYear) setAcademicYear(student.academicYear);
        setSelectedStudent(student);
    };

    const renderStudentStatusPill = (status) => {
        const normalizedStatus = formatDisplayValue(status || studentStatus);
        const tone = normalizedStatus === 'Active'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : normalizedStatus === 'Passed Out'
                ? 'border-slate-200 bg-slate-100 text-slate-600'
                : 'border-amber-200 bg-amber-50 text-amber-700';

        return (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {normalizedStatus || 'Unknown'}
            </span>
        );
    };

    const exportStudentSummaryToExcel = async () => {
        const exportStudents = [];
        const totalPages = Math.max(1, Math.ceil(studentDirectorySummary.total / 100));
        for (let exportPage = 1; exportPage <= totalPages; exportPage += 1) {
            const { data } = await apiClient.get('/api/students', { params: {
                academicYear,
                status: studentStatus,
                includeSummaryCounts: true,
                page: exportPage,
                limit: 100,
                ...(debouncedSearchTerm ? { search: debouncedSearchTerm } : {}),
                ...(classFilter ? { className: classFilter } : {}),
                ...(sectionFilter ? { section: sectionFilter } : {}),
                sortBy: studentSummarySort.key,
                sortDirection: studentSummarySort.direction,
            } });
            exportStudents.push(...(Array.isArray(data?.data) ? data.data : []));
        }
        const ws = XLSX.utils.json_to_sheet(buildStudentSummaryRows(exportStudents));
        const wb = XLSX.utils.book_new();
        const exportDate = new Date().toISOString().split('T')[0];
        const reportInfoWs = XLSX.utils.json_to_sheet([
            { Field: 'Report', Value: isPassedOutSummary ? 'Passed Out Student Summary' : 'Student Summary' },
            { Field: 'Generated On', Value: exportDate },
            { Field: 'Academic Year', Value: academicYear || currentAcademicYear || 'All years' },
            { Field: 'Student Status', Value: studentStatus },
            { Field: 'Search', Value: searchTerm || 'None' },
            { Field: 'Class', Value: classFilter || 'All classes' },
            { Field: 'Section', Value: sectionFilter || 'All sections' },
            { Field: 'Record Count', Value: studentDirectorySummary.total },
        ]);
        XLSX.utils.book_append_sheet(wb, reportInfoWs, 'Report Info');
        XLSX.utils.book_append_sheet(wb, ws, 'Student Summary');
        await withFeedback(
            addToast,
            () => downloadWorkbook(
                XLSX,
                wb,
                `${slugify(isPassedOutSummary ? 'Passed_Out_Student_Summary' : 'Student_Summary')}_${slugify(academicYear || currentAcademicYear || 'All_Years')}_${exportDate}.xlsx`,
                { title: 'Student Summary' }
            ),
            {
                successMessage: 'Excel exported successfully.',
                errorMessage: 'Export failed.',
            }
        );
    };

    if (loading && !hasLoadedStudentsRef.current) {
        return (
            <div className="flex min-h-screen bg-slate-100 ">
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

    const studentSummaryColumns = [
        { key: 'admissionNo', label: renderSortLabel('admissionNo', 'Admission No'), render: (row) => row.admissionNo || 'N/A' },
        {
            key: 'name',
            label: renderSortLabel('name', 'Student Name'),
            render: (row) => (
                <button
                    type="button"
                    onClick={() => openStudentSummary(row)}
                    className="font-semibold text-blue-700 hover:text-blue-900 "
                >
                    {row.name || 'Unknown Student'}
                </button>
            ),
        },
        { key: 'className', label: renderSortLabel('className', 'Class'), render: (row) => row.className || 'N/A' },
        { key: 'section', label: renderSortLabel('section', 'Section'), render: (row) => row.section || 'N/A' },
        { key: 'incidentCount', label: renderSortLabel('incidentCount', 'Incidents'), render: (row) => row.incidentCount || 0 },
        { key: 'letterCount', label: renderSortLabel('letterCount', 'Letters'), render: (row) => row.letterCount || 0 },
        { key: 'status', label: renderSortLabel('status', 'Status'), render: (row) => renderStudentStatusPill(row.status) },
        {
            key: 'action',
            label: 'Action',
            render: (row) => (
                <button
                    type="button"
                    onClick={() => openStudentSummary(row)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={`View ${row.name || 'student'} summary`}
                    title="View summary"
                >
                    <Eye size={16} aria-hidden="true" />
                </button>
            ),
        },
    ];

    const incidentColumns = [
        { key: 'serialNumber', label: 'S.No', render: (row, index) => index + 1 },
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
                    {formatDisplayValue(row.status)}
                </span>
            ),
        },
        { key: 'opened', label: 'Opened', render: (row) => formatShortDate(getIncidentOpenedTimestamp(row)) },
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

    const letterColumns = [
        { key: 'letterNumber', label: 'Letter Number', render: (row) => <span className="font-mono text-xs text-slate-600">{row.letterNumber}</span> },
        { key: 'templateName', label: 'Letter Name', render: (row) => row.templateName || row.title || 'Official letter' },
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
                        className="btn-export-icon"
                            title="Download Word File"
                    >
                        {downloadingLetterId === row._id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    </button>
                </div>
            ),
        },
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



    const directoryFilterLabels = [
        academicYear && academicYear !== currentAcademicYear ? `Year: ${academicYear}` : null,
        searchTerm ? `Search: ${searchTerm}` : null,
        classFilter ? `Class: ${classFilter}` : null,
        sectionFilter ? `Section: ${sectionFilter}` : null,
    ].filter(Boolean);

    const studentFilterLabels = [
        academicYear && academicYear !== currentAcademicYear ? `Year: ${academicYear}` : null,
        dateRange.start || dateRange.end ? `Dates: ${dateRange.start || 'Any'} to ${dateRange.end || 'Any'}` : null,
        ...filters.incidentTypes.map((value) => `Category: ${value}`),
        ...filters.locations.map((value) => `Location: ${value}`),
        ...filters.evidence.map((value) => `Evidence: ${value}`),
        ...statusFilter.map((value) => `Status: ${value}`),
    ].filter(Boolean);

    const studentSummaryRangeStart = studentVisibleTotal === 0 ? 0 : studentPageStartIndex + 1;
    const studentSummaryRangeEnd = Math.min(studentPageStartIndex + studentRowsPerPage, studentVisibleTotal);
    const studentPaginationPages = Array.from({ length: studentSummaryTotalPages }, (_, index) => index + 1)
        .filter((page) => (
            page === 1 ||
            page === studentSummaryTotalPages ||
            Math.abs(page - normalizedStudentPage) <= 1
        ));
    const resetDirectoryFilters = () => {
        setSearchTerm('');
        setClassFilter('');
        setSectionFilter('');
        setAcademicYear(currentAcademicYear);
    };

    return (
        <div className="student-analytics flex min-h-screen bg-slate-100 ">
            <div className="flex min-w-0 flex-1 flex-col">
                <main ref={mainScrollContainerRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-6">
                        {!selectedStudent ? (
                            <>
                                <DashboardHero
                                    eyebrow="Student Analytics"
                                    title="Student Analytics"
                                    description={isPassedOutSummary ? 'View passed-out student records with historical class and section snapshots.' : 'View student records and incident history.'}
                                    icon={Users}
                                    actions={(
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={exportStudentSummaryToExcel}
                                                className="btn-export"
                                            >
                                                <Download size={14} aria-hidden="true" />
                                                Export to Excel
                                            </button>
                                        </div>
                                    )}

                                />

                                <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm ">
                                    {[
                                        { key: 'active', label: 'Active Students' },
                                        { key: 'passedOut', label: 'Passed Out Students' },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => {
                                                setActiveSummaryTab(tab.key);
                                                setSelectedStudent(null);
                                                setStudentIncidents([]);
                                                setStudentLetters([]);
                                            }}
                                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                                activeSummaryTab === tab.key
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-slate-600 hover:bg-slate-50 '
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <UnifiedFilterBar
                                    hasActiveFilters={Boolean(searchTerm) || Boolean(classFilter) || Boolean(sectionFilter) || Boolean(academicYear && academicYear !== currentAcademicYear)}
                                    onReset={() => {
                                        setSearchTerm('');
                                        setClassFilter('');
                                        setSectionFilter('');
                                        setAcademicYear(currentAcademicYear);
                                    }}
                                    title="Find a Student"
                                    activeFilterLabels={directoryFilterLabels}
                                    collapsible
                                    defaultCollapsed
                                >
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Academic Year</label>
                                            <select
                                                value={academicYear}
                                                onChange={(event) => setAcademicYear(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus-visible:outline-none"
                                            >
                                                {academicYearOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(event) => setSearchTerm(event.target.value)}
                                                    placeholder="Name or admission number…"
                                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus-visible:outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Class</label>
                                            <select
                                                value={classFilter}
                                                onChange={(event) => setClassFilter(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus-visible:outline-none"
                                            >
                                                <option value="">All classes</option>
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
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus-visible:outline-none"
                                            >
                                                <option value="">All sections</option>
                                                {filteredSections.map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </UnifiedFilterBar>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <DashboardStatCard title={isPassedOutSummary ? 'Passed Out Students' : 'Total Students'} value={studentDirectorySummary.total} icon={Users} tone="blue" helper={isPassedOutSummary ? 'Students matching the selected status.' : 'Students in the directory.'} />
                                    </div>

                                <DashboardPanel
                                    title={isPassedOutSummary ? 'Passed Out Students' : 'Student Summary'}
                                    description={`${studentDirectorySummary.total} record${studentDirectorySummary.total === 1 ? '' : 's'} across the selected filters.`}
                                    icon={Users}
                                >
                                    {studentDirectorySummary.total === 0 ? (
                                        <EmptyStatePanel
                                            title="No students found"
                                            description={searchTerm || classFilter || sectionFilter ? 'Try broadening your filters to surface more students.' : 'No students are currently available in the directory.'}
                                            action={(
                                                <button
                                                    type="button"
                                                    onClick={resetDirectoryFilters}
                                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                >
                                                    Reset filters
                                                </button>
                                            )}
                                        />
                                    ) : (
                                        <>
                                            <div className="student-summary-table">
                                                <div className="hidden md:block">
                                                    <table className="w-full min-w-[860px] table-fixed border-collapse">
                                                        <thead className="sticky top-0 z-10 bg-slate-50">
                                                            <tr>
                                                                {studentSummaryColumns.map((column) => (
                                                                    <th
                                                                        key={column.key}
                                                                        scope="col"
                                                                        className="border-b border-slate-200 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500"
                                                                    >
                                                                        {column.label}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {paginatedStudents.map((student, index) => (
                                                                <tr
                                                                    key={student.id || `${student._id}-${student.academicYear}` || index}
                                                                    onClick={() => openStudentSummary(student)}
                                                                    className="cursor-pointer bg-white transition hover:bg-blue-50/50"
                                                                    tabIndex={0}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                                            event.preventDefault();
                                                                            openStudentSummary(student);
                                                                        }
                                                                    }}
                                                                >
                                                                    {studentSummaryColumns.map((column) => (
                                                                        <td key={column.key} className="px-4 py-3 text-sm font-medium text-slate-700">
                                                                            {column.render ? column.render(student, index) : student?.[column.key]}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div className="divide-y divide-slate-100 md:hidden">
                                                    {paginatedStudents.map((student) => (
                                                        <div
                                                            key={student.id || `${student._id}-${student.academicYear}`}
                                                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-4"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => openStudentSummary(student)}
                                                                className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                            >
                                                                <p className="truncate text-sm font-bold text-slate-950">{student?.name || 'Unknown Student'}</p>
                                                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                                                    {student?.admissionNo || 'N/A'} - Class {student?.className || 'N/A'} - Section {student?.section || 'N/A'}
                                                                </p>
                                                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
                                                                    <span>Incidents: {student?.incidentCount || 0}</span>
                                                                    <span>Letters: {student?.letterCount || 0}</span>
                                                                </div>
                                                            </button>
                                                            <div className="flex flex-col items-end justify-between gap-3">
                                                                {renderStudentStatusPill(student?.status)}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openStudentSummary(student)}
                                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                                    aria-label={`View ${student?.name || 'student'} summary`}
                                                                >
                                                                    <Eye size={16} aria-hidden="true" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 border-t border-slate-100 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-sm font-medium text-slate-600">
                                                    Showing {studentSummaryRangeStart} to {studentSummaryRangeEnd} of {studentVisibleTotal} students
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setStudentSummaryPage((page) => Math.max(1, page - 1))}
                                                        disabled={normalizedStudentPage === 1}
                                                        className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        Previous
                                                    </button>
                                                    {studentPaginationPages.map((page, index) => {
                                                        const previousPage = studentPaginationPages[index - 1];
                                                        const showGap = previousPage && page - previousPage > 1;
                                                        return (
                                                            <React.Fragment key={page}>
                                                                {showGap ? <span className="px-1 text-sm text-slate-400">...</span> : null}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setStudentSummaryPage(page)}
                                                                    className={`h-10 min-w-10 rounded-lg border px-3 text-sm font-semibold transition ${
                                                                        normalizedStudentPage === page
                                                                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                                    }`}
                                                                    aria-current={normalizedStudentPage === page ? 'page' : undefined}
                                                                >
                                                                    {page}
                                                                </button>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                    <button
                                                        type="button"
                                                        onClick={() => setStudentSummaryPage((page) => Math.min(studentSummaryTotalPages, page + 1))}
                                                        disabled={normalizedStudentPage === studentSummaryTotalPages}
                                                        className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        Next
                                                    </button>
                                                    <label className="ml-0 flex items-center gap-2 text-sm font-medium text-slate-600 sm:ml-2">
                                                        Rows
                                                        <select
                                                            value={studentRowsPerPage}
                                                            onChange={(event) => setStudentRowsPerPage(Number(event.target.value))}
                                                            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                        >
                                                            {[10, 25, 50, 100].map((size) => (
                                                                <option key={size} value={size}>{size}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </DashboardPanel>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                        <TrendingUp size={16} className="text-blue-600" aria-hidden="true" />
                                        <span className="text-blue-700">Student Analytics</span>
                                        <span className="text-slate-300">/</span>
                                        <span className="text-slate-900">{selectedStudent?.name || 'Student Summary'}</span>
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedStudent(null);
                                                setStudentIncidents([]);
                                                setStudentLetters([]);
                                                navigate('/student-analytics');
                                            }}
                                            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto"
                                        >
                                            <ArrowLeft size={16} aria-hidden="true" />
                                            Back to Student Analytics
                                        </button>
                                    </div>
                                </div>

                                <section className="dashboard-panel">
                                    <div className="p-4 sm:p-5">
                                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-3xl font-bold text-blue-700">
                                                {selectedStudent?.name?.charAt(0)?.toUpperCase() || 'S'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-950">
                                                        {selectedStudent?.name || 'Student Summary'}
                                                    </h1>
                                                    {renderStudentStatusPill(selectedStudent?.status)}
                                                </div>
                                                <p className="mt-2 text-sm font-medium text-slate-600">
                                                    Admission No: {selectedStudent?.admissionNo || 'N/A'}
                                                    <span className="mx-2 text-slate-300">-</span>
                                                    Class {selectedStudent?.className || 'N/A'} - {selectedStudent?.section || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </section>

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
                                    activeFilterLabels={studentFilterLabels}
                                    collapsible
                                    defaultCollapsed
                                >
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
                                            selected={statusFilter}
                                            onChange={setStatusFilter}
                                            placeholder="All statuses"
                                            searchPlaceholder="Search statuses…"
                                        />
                                    </div>
                                </UnifiedFilterBar>

                                {loading && studentIncidents.length === 0 ? (
                                    <DashboardPageSkeleton showHero={false} />
                                ) : (
                                    <>
                                        <div className="student-detail-stats grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                                            <DashboardStatCard title="Total Incidents" value={studentAnalytics.total} icon={FileText} tone="blue" helper="All filtered incidents" />
                                            <DashboardStatCard title="Pending" value={studentAnalytics.pending} icon={AlertTriangle} tone="amber" helper="Needs attention" />
                                            <DashboardStatCard title="Closed" value={studentAnalytics.closed} icon={CheckCircle} tone="emerald" helper="Resolved cases" />
                                            <DashboardStatCard title="Letters Sent" value={studentAnalytics.generatedLetters} icon={Mail} tone="emerald" helper="Letters completed for this student" />
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                            <DashboardWidgetPanel
                                                title="Incident Status over Time"
                                                description="Daily pending and closed counts using the incident timeline date."
                                                icon={TrendingUp}
                                                chart={<IncidentStatusTrendChart data={studentAnalytics.statusTrendData} idPrefix="student-status" />}
                                                footer={
                                                    <LegendList
                                                        items={[
                                                            { label: 'Pending', color: STATUS_COLORS.Pending },
                                                            { label: 'Closed', color: STATUS_COLORS.Closed },
                                                        ]}
                                                    />
                                                }
                                                tableColumns={statusTrendColumns}
                                                tableRows={studentAnalytics.statusTrendData}
                                                emptyMessage="No status trend data is available for the current filters."
                                            />

                                            <DashboardWidgetPanel
                                                title="New Incidents by Day"
                                                description="New incidents per day based on the timeline date."
                                                icon={AlertTriangle}
                                                chart={<DailyCreationTrendChart data={studentAnalytics.creationTrendData} />}
                                                footer={
                                                    <LegendList
                                                        items={[
                                                            { label: 'New Incidents', color: CHART_COLORS.neutralPrimary },
                                                        ]}
                                                    />
                                                }
                                                tableColumns={creationTrendColumns}
                                                tableRows={studentAnalytics.creationTrendData}
                                                emptyMessage="No creation trend data is available for the current filters."
                                            />

                                            <DashboardWidgetPanel
                                                title="Evidence Distribution"
                                                description="Types of evidence files associated with this student's recorded incidents."
                                                icon={ShieldCheck}
                                                chart={
                                                    studentAnalytics.evidenceData.length === 0 ? (
                                                        <EmptyStatePanel title="No evidence data." description="No evidence records are available for the current filters." />
                                                    ) : (
                                                        <ChartSurface height={240}>
                                                            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                                <PieChart>
                                                                    <Pie
                                                                        data={studentAnalytics.evidenceData}
                                                                        dataKey="count"
                                                                        nameKey="name"
                                                                        innerRadius={compactChart ? 44 : 54}
                                                                        outerRadius={compactChart ? 74 : 88}
                                                                        paddingAngle={4}
                                                                    >
                                                                        {studentAnalytics.evidenceData.map((entry, index) => (
                                                                            <Cell
                                                                                key={entry.name}
                                                                                fill={[CHART_COLORS.evidence, STATUS_COLORS['In Progress'], STATUS_COLORS.Closed, STATUS_COLORS.Open, CHART_COLORS.category, CHART_COLORS.neutralPrimary, '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#10b981'][index % 10]}
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
                                                    studentAnalytics.evidenceData.length > 0 ? (
                                                        <LegendList
                                                            items={studentAnalytics.evidenceData.map((entry, index) => ({
                                                                label: entry.name,
                                                                value: entry.count,
                                                                color: [CHART_COLORS.evidence, STATUS_COLORS.Closed, STATUS_COLORS.Pending, CHART_COLORS.category, CHART_COLORS.neutralPrimary, '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#10b981'][index % 10],
                                                            }))}
                                                        />
                                                    ) : null
                                                }
                                                tableColumns={evidenceColumns}
                                                tableRows={studentAnalytics.evidenceData}
                                                emptyMessage="No evidence data is available for the current filters."
                                            />

                                            <DashboardWidgetPanel
                                                title="Where Incidents Occurred"
                                                description="Number of incidents recorded at each school location."
                                                icon={ShieldCheck}
                                                chart={
                                                    <ChartSurface height={Math.max(280, (studentAnalytics.locationData?.length || 0) * 36)}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                        <BarChart data={studentAnalytics.locationData} layout="vertical" margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
                                                            <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" horizontal={false} />
                                                            <XAxis type="number" tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} />
                                                            <YAxis dataKey="location" type="category" width={compactChart ? 120 : 155} axisLine={false} tickLine={false} {...compactYAxisProps} />
                                                            <ChartTooltip />
                                                            <Bar dataKey="count" fill={CHART_COLORS.location} radius={[0, 8, 8, 0]} name="Incidents" maxBarSize={28}>
                                                                <LabelList dataKey="count" position="right" fill={CHART_THEME.label} fontSize={12} />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>

                                                    </ChartSurface>
                                                }
                                                footer={
                                                    <LegendList
                                                        items={studentAnalytics.locationData.map((entry) => ({
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
                                                className="lg:col-span-2"
                                                title="Incidents by Type"
                                                description="Most frequent incident categories involving this student."
                                                icon={FileText}
                                                chart={
                                                    <ChartSurface height={280}>
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                                                        <BarChart data={studentAnalytics.categoryData} margin={horizontalBarMargin}>
                                                            <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                                                            <XAxis dataKey="category" axisLine={false} tickLine={false} {...compactXAxisProps} />
                                                            <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (dataMax) => Math.max(1, dataMax)]} />
                                                            <ChartTooltip />
                                                            <Bar dataKey="count" fill={CHART_COLORS.category} radius={[6, 6, 0, 0]} name="Incidents" maxBarSize={45}>
                                                                <LabelList dataKey="count" position="top" fill={CHART_THEME.label} fontSize={12} />
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
                                                tableRows={studentAnalytics.categoryData}
                                                emptyMessage="No category data is available for the current filters."
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
                                                    className="btn-export"
                                                >
                                                    <Download size={14} aria-hidden="true" />
                                                    Export to Excel
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
                                                    title="No letters found."
                                                    description="No letters match the current filters, or no letters have been issued yet."
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
