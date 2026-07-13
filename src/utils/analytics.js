import dayjs from 'dayjs';
import { getRecordId } from './ids';

/** Plain-language label for activity record types shown to staff (not internal API names). */
export const formatActivityRecordLabel = (type) => {
    const raw = String(type || '').trim();
    if (!raw) return 'System Activity';
    const key = raw.toLowerCase().replace(/\s+/g, ' ');
    const compact = key.replace(/[_-]/g, '');
    const map = {
        incident: 'Incident',
        letter: 'Issued Letter',
        issuedletter: 'Issued Letter',
        template: 'Letter Template',
        lettertemplate: 'Letter Template',
        category: 'Incident Category',
        incidentcategory: 'Incident Category',
        location: 'Location',
        student: 'Student',
        user: 'User',
        staff: 'Staff',
        system: 'System Activity',
        analytics: 'System Activity',
        bulkupload: 'System Activity',
        evidencetype: 'Evidence Type',
        log: 'System Activity',
    };
    return map[key] || map[compact] || raw;
};

export const STATUS_OPTIONS = [
    { id: 'Pending', label: 'Pending' },
    { id: 'Closed', label: 'Closed' },
];
export const ALL_ACADEMIC_YEARS_VALUE = 'all';

export const buildAcademicYearOptions = (academicYears = [], currentAcademicYear = '') => {
    const sortAcademicYearsDesc = (first, second) => {
        const firstYear = Number(String(first).slice(0, 4));
        const secondYear = Number(String(second).slice(0, 4));
        if (!Number.isNaN(firstYear) && !Number.isNaN(secondYear)) return secondYear - firstYear;
        return String(second).localeCompare(String(first));
    };
    const orderedYears = [
        currentAcademicYear,
        ...academicYears
            .filter((year) => year !== currentAcademicYear)
            .sort(sortAcademicYearsDesc),
    ].filter(Boolean);
    const uniqueYears = Array.from(new Set(orderedYears));

    return [
        { value: ALL_ACADEMIC_YEARS_VALUE, label: 'All years' },
        ...uniqueYears.map((year) => ({
            value: year,
            label: year === currentAcademicYear ? `${year} (Current)` : year,
        })),
    ];
};

export const STATUS_COLORS = {
    Pending: '#f97316',
    Closed: '#22c55e',
};

export const CHART_COLORS = {
    neutralPrimary: '#475569',
    neutralSoft: '#94a3b8',
    generated: '#22c55e',
    pending: '#f97316',
    category: '#3b82f6',
    location: '#475569',
    evidence: '#0f766e',
};

export const UNKNOWN_FILTER_OPTION = 'Unknown';

const normalizeNullableFilterValue = (value) => {
    const normalized = String(value ?? '').trim();
    return normalized || UNKNOWN_FILTER_OPTION;
};

export const normalizeToStartOfDay = (value) => {
    const localDate = parseLocalDateParam(value);
    return localDate ? dayjs(localDate).startOf('day').valueOf() : null;
};

export const normalizeDateParam = (value) => {
    if (!value) return '';

    if (typeof value === 'string') {
        const trimmed = value.trim();
        const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateOnlyMatch) return dateOnlyMatch[0];
    }

    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
};

export const parseLocalDateParam = (value) => {
    const normalized = normalizeDateParam(value);
    if (!normalized) return null;

    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const appendListParam = (params, key, values = []) => {
    if (!(params instanceof URLSearchParams)) return params;

    const list = (Array.isArray(values) ? values : [values])
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    if (list.length > 0) {
        params.append(key, [...new Set(list)].join(','));
    }

    return params;
};

export const appendScalarParam = (params, key, value) => {
    if (!(params instanceof URLSearchParams)) return params;

    const normalizedValue = String(value ?? '').trim();
    if (!normalizedValue) return params;

    const lowered = normalizedValue.toLowerCase();
    if (lowered === 'all' || lowered === 'undefined' || lowered === 'null') {
        return params;
    }

    params.append(key, normalizedValue);
    return params;
};

export const appendDateRangeParams = (params, dateRange = { start: '', end: '' }) => {
    if (!(params instanceof URLSearchParams)) return params;

    const startDate = normalizeDateParam(dateRange?.start);
    if (startDate) {
        params.append('startDate', startDate);
    }

    const endDate = normalizeDateParam(dateRange?.end);
    if (endDate) {
        params.append('endDate', endDate);
    }

    return params;
};

export const buildIncidentFilterParams = ({
    dateRange = { start: '', end: '' },
    statuses = [],
    classes = [],
    sections = [],
    types = [],
    locations = [],
    evidenceTypes = [],
    staffIds = [],
    includeUnassigned = false,
    includeAdminRole = false,
    students = [],
    admissionNos = [],
} = {}) => {
    const params = new URLSearchParams();

    appendDateRangeParams(params, dateRange);
    appendListParam(params, 'statuses', statuses);
    appendListParam(params, 'classes', classes);
    appendListParam(params, 'sections', sections);
    appendListParam(params, 'types', types);
    appendListParam(params, 'locations', locations);
    appendListParam(params, 'evidenceTypes', evidenceTypes);
    appendListParam(params, 'staff', staffIds);
    appendListParam(params, 'students', students);
    appendListParam(params, 'admissionNo', admissionNos);

    if (includeUnassigned) {
        params.append('unassigned', 'true');
    }

    // When "Administration" is selected, tell the backend to include ALL admin-role
    // users (not just unassigned / null handler). The backend resolves this to an
    // $in query over every userId whose role === 'Admin'.
    if (includeAdminRole) {
        params.append('includeAdminRole', 'true');
    }

    return params;
};

export const buildIssuedLetterFilterParams = ({
    dateRange = { start: '', end: '' },
    classNames = [],
    sections = [],
    incidentCategories = [],
    status = '',
    studentName = '',
    admissionNo = '',
} = {}) => {
    const params = new URLSearchParams();

    appendDateRangeParams(params, dateRange);
    appendListParam(params, 'className', classNames);
    appendListParam(params, 'section', sections);
    appendListParam(params, 'incidentCategory', incidentCategories);
    appendScalarParam(params, 'status', status);
    appendScalarParam(params, 'studentName', studentName);
    appendScalarParam(params, 'admissionNo', admissionNo);

    return params;
};

export const getIncidentTimestamp = (incident) =>
    incident?.incidentDate || incident?.incident_date || incident?.openedAt || incident?.submittedAt || null;

export const getLetterTimelineTimestamp = (letter) =>
    letter?.incident?.incidentDate ||
    letter?.incident?.incident_date ||
    letter?.incident?.openedAt ||
    letter?.incident?.submittedAt ||
    letter?.generatedAt ||
    null;

export const resolveUserLabel = (user, fallback = 'Unknown User') => {
    if (!user) return fallback;
    if (typeof user === 'object' && user !== null) {
        return user.name || fallback;
    }
    return typeof user === 'string' ? user : fallback;
};

export const resolveHandlerLabel = (incident) => {
    const handler = incident?.assignedHandler;
    if (handler) {
        return resolveUserLabel(handler, 'Unknown User');
    }
    return resolveUserLabel(incident?.reportedBy, 'Unknown User');
};

export const toneForStatus = (status) => {
    if (status === 'Closed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-orange-50 text-orange-700 border-orange-200';
};

export const formatShare = (value, total) => (total > 0 ? `${Math.round((value / total) * 100)}%` : '0%');

export const buildDistribution = (items, resolver, keyName = 'name') => {
    const map = {};
    items.forEach((item) => {
        const key = normalizeNullableFilterValue(resolver(item));
        map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
        .map(([name, count]) => ({ [keyName]: name, count }))
        .sort((a, b) => b.count - a.count);
};

export const buildEvidenceDistribution = (items, { unknownEvidenceLabel = UNKNOWN_FILTER_OPTION } = {}) => {
    const counts = {};

    items.forEach((incident) => {
        if (incident.evidence && incident.evidence.length > 0) {
            incident.evidence.forEach((entry) => {
                const name = normalizeNullableFilterValue(entry?.evidenceType || unknownEvidenceLabel);
                counts[name] = (counts[name] || 0) + 1;
            });
        } else {
            counts[unknownEvidenceLabel] = (counts[unknownEvidenceLabel] || 0) + 1;
        }
    });

    return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
};

const sortIncidentsByRecentActivity = (items) =>
    [...items].sort(
        (a, b) =>
            new Date(b.updatedAt || getIncidentTimestamp(b) || 0) -
            new Date(a.updatedAt || getIncidentTimestamp(a) || 0)
    );

export const buildDashboardActivityFeed = (incidents = [], { icons = {} } = {}) =>
    sortIncidentsByRecentActivity(incidents)
        .slice(0, 6)
        .map((incident) => ({
            id: getRecordId(incident),
            title: incident.title || 'Untitled incident',
            description: `${incident.studentsInvolved?.[0] || incident.studentDetails?.name || 'Student unavailable'} — ${incident.status || 'Unknown'}`,
            timestamp: formatShortDateTime(incident.updatedAt || getIncidentTimestamp(incident)),
            icon:
                incident.status === 'Closed'
                    ? icons.closed
                    : icons.open,
            tone: incident.status === 'Closed' ? 'emerald' : 'amber',
        }));

export const buildAnalyticsActivityFeed = (items, { ActivityIcon } = {}) =>
    sortIncidentsByRecentActivity(items)
        .slice(0, 6)
        .map((incident) => {
            const incidentDate = incident?.closedAt || incident?.updatedAt || getIncidentTimestamp(incident);
            let title = 'Incident created';
            let tone = 'blue';
            let description = `${incident?.title || 'Untitled incident'} was opened`;

            if (incident?.status === 'Closed' && incident?.closedAt) {
                title = 'Incident closed';
                tone = 'emerald';
                description = `${incident?.title || 'Untitled incident'} was resolved`;
            } else if (incident?.updatedAt && incident.updatedAt !== incident.createdAt) {
                title = 'Incident updated';
                tone = 'amber';
                description = `${incident?.title || 'Untitled incident'} received new activity`;
            }

            return {
                id: getRecordId(incident) || `${title}-${incidentDate}`,
                title,
                description,
                timestamp: formatShortDateTime(incidentDate),
                icon: ActivityIcon,
                tone,
            };
        });

export const formatShortDate = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

export const formatShortDateTime = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const formatExportDate = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).replace(/ /g, '-');
};

export const resolveIncidentPriorityForExport = (incident) => {
    if (incident?.isHighPriority === true) return 'High Priority';

    const normalizedPriority = String(incident?.priority || incident?.severity || '')
        .trim()
        .toLowerCase();
    if (['high', 'high priority', 'critical', 'urgent'].includes(normalizedPriority)) {
        return 'High Priority';
    }

    const category = String(incident?.category || incident?.incidentCategory || incident?.title || '')
        .trim()
        .toLowerCase();
    const highPriorityCategoryPatterns = [
        /\bviolence\b/,
        /\bviolent\b/,
        /\bfight(?:ing)?\b/,
        /\bbully(?:ing)?\b/,
        /\bserious\s+misconduct\b/,
        /\bparent\s+complaint\b/,
        /\brepeated\s+offender\b/,
    ];
    if (highPriorityCategoryPatterns.some((pattern) => pattern.test(category))) {
        return 'High Priority';
    }

    return 'Normal';
};

export const formatProgressLogForExport = (progressLogs = []) => {
    if (!Array.isArray(progressLogs) || progressLogs.length === 0) return 'N/A';

    return progressLogs
        .map((log) => {
            const note = String(log?.note || '').trim();
            if (!note) return '';
            return `${note} (${formatExportDate(log?.timestamp)})`;
        })
        .filter(Boolean)
        .join('\n→ ');
};

export const buildAppliedFilterRows = (filters = []) =>
    filters
        .map(({ label, value }) => {
            const values = Array.isArray(value) ? value : [value];
            const displayValue = values
                .map((item) => String(item ?? '').trim())
                .filter(Boolean)
                .join(', ');

            return displayValue ? [label, displayValue] : null;
        })
        .filter(Boolean);

export const buildManagementReportWorksheet = (XLSX, {
    reportTitle,
    generatedBy = 'Unknown',
    generatedOn = new Date(),
    academicYear = 'All years',
    contextRows = [],
    appliedFilters = [],
    totalRecords = 0,
    columns = [],
    rows = [],
} = {}) => {
    const headerRows = [
        ['Incident Tracking System'],
        [reportTitle || 'Analytics Report'],
        [],
        ['Generated On:', formatShortDateTime(generatedOn)],
        ['Generated By:', generatedBy || 'Unknown'],
        ...contextRows.filter((row) => row?.[0] && row?.[1]),
        ['Academic Year:', academicYear || 'All years'],
        [],
    ];
    const filterRows = buildAppliedFilterRows(appliedFilters);
    headerRows.push(['Applied Filters:']);
    if (filterRows.length > 0) {
        headerRows.push(...filterRows.map(([label, value]) => [`${label}:`, value]));
    } else {
        headerRows.push(['None', 'All records']);
    }
    headerRows.push(['Total Records:', totalRecords], []);

    const tableRows = [
        columns,
        ...rows.map((row) => columns.map((column) => row?.[column] ?? '')),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...headerRows, ...tableRows]);
    const lastColumnIndex = Math.max(columns.length - 1, 1);
    const tableHeaderRowIndex = headerRows.length;
    const lastRowIndex = headerRows.length + tableRows.length - 1;

    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumnIndex } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumnIndex } },
    ];
    worksheet['!cols'] = columns.map((column) => {
        if (column === 'Description') return { wch: 48 };
        if (column === 'Progress Log') return { wch: 58 };
        if (['Student Name', 'Category', 'Reporter', 'Handler', 'Evidence'].includes(column)) return { wch: 24 };
        return { wch: Math.max(12, Math.min(22, String(column).length + 4)) };
    });
    worksheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({
            s: { r: tableHeaderRowIndex, c: 0 },
            e: { r: Math.max(tableHeaderRowIndex, lastRowIndex), c: lastColumnIndex },
        }),
    };

    return worksheet;
};

export const normalizeOptionList = (options = []) =>
    options
        .map((option) => {
            if (typeof option === 'string') return option;
            return option?.name || option?.label || option?.title || '';
        })
        .map((option) => String(option || '').trim())
        .filter(Boolean);

export const withUnknownOption = (options = [], includeUnknown = false) => {
    const normalized = normalizeOptionList(options);
    const deduped = [];
    const seen = new Set();

    normalized.forEach((option) => {
        const key = option.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(option);
    });

    if (includeUnknown && !seen.has(UNKNOWN_FILTER_OPTION.toLowerCase())) {
        deduped.push(UNKNOWN_FILTER_OPTION);
    }

    return deduped;
};

export const hasUnknownLocation = (items = []) =>
    items.some((incident) => normalizeNullableFilterValue(incident?.location) === UNKNOWN_FILTER_OPTION);

export const hasUnknownEvidenceType = (items = []) =>
    items.some((incident) => {
        if (!Array.isArray(incident?.evidence) || incident.evidence.length === 0) return true;
        return incident.evidence.some((entry) => normalizeNullableFilterValue(entry?.evidenceType) === UNKNOWN_FILTER_OPTION);
    });

const formatDayBucketLabel = (value) => {
    const parsed = dayjs(value);
    if (!parsed.isValid()) return '';
    return parsed.format('MMM D');
};

const formatDayBucketTitle = (value) => {
    const parsed = dayjs(value);
    if (!parsed.isValid()) return '';
    return parsed.format('MMM D, YYYY');
};

const resolveDailyWindow = (resolvedItems, dateRange, fallbackDays) => {
    const explicitStartDate = parseLocalDateParam(dateRange?.start);
    const explicitEndDate = parseLocalDateParam(dateRange?.end);
    const explicitStart = explicitStartDate ? dayjs(explicitStartDate).startOf('day') : null;
    const explicitEnd = explicitEndDate ? dayjs(explicitEndDate).endOf('day') : null;

    if (explicitStart?.isValid() && explicitEnd?.isValid()) {
        return {
            start: explicitStart,
            end: explicitEnd,
        };
    }

    if (explicitStart?.isValid()) {
        const latest = resolvedItems.length > 0
            ? dayjs(Math.max(...resolvedItems.map(({ parsed }) => parsed.getTime()))).endOf('day')
            : dayjs().endOf('day');

        return {
            start: explicitStart,
            end: latest,
        };
    }

    if (explicitEnd?.isValid()) {
        return {
            start: explicitEnd.startOf('day').subtract(fallbackDays - 1, 'day'),
            end: explicitEnd,
        };
    }

    if (resolvedItems.length > 0) {
        const latest = dayjs(Math.max(...resolvedItems.map(({ parsed }) => parsed.getTime()))).endOf('day');
        const earliest = dayjs(Math.min(...resolvedItems.map(({ parsed }) => parsed.getTime()))).startOf('day');

        let start = earliest;
        if (latest.diff(earliest, 'day') < 14) {
            start = latest.subtract(13, 'day').startOf('day');
        }

        return {
            start,
            end: latest,
        };
    }

    return {
        start: dayjs().startOf('day').subtract(fallbackDays - 1, 'day'),
        end: dayjs().endOf('day'),
    };
};

export const buildDailySeries = ({
    items = [],
    dateRange = { start: '', end: '' },
    resolveDate,
    project,
    fallbackDays = 14,
}) => {
    if (typeof resolveDate !== 'function' || typeof project !== 'function') return [];

    const resolvedItems = items
        .map((item) => {
            const value = resolveDate(item);
            if (!value) return null;

            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return null;

            return { item, parsed };
        })
        .filter(Boolean);

    const windowRange = resolveDailyWindow(resolvedItems, dateRange, fallbackDays);
    if (!windowRange?.start?.isValid?.() || !windowRange?.end?.isValid?.() || windowRange.start.valueOf() > windowRange.end.valueOf()) {
        return [];
    }

    const start = windowRange.start;
    const end = windowRange.end;
    const durationDays = end.diff(start, 'day') + 1;

    let mode = 'daily';
    if (durationDays > 30 && durationDays <= 90) {
        mode = 'weekly';
    } else if (durationDays > 90) {
        mode = 'monthly';
    }

    const series = [];

    if (mode === 'daily') {
        let cursor = start.startOf('day');
        while (cursor.valueOf() <= end.endOf('day').valueOf()) {
            const bucketStart = cursor.startOf('day');
            const bucketEnd = cursor.endOf('day');
            const bucketItems = resolvedItems
                .filter(({ parsed }) => parsed >= bucketStart.toDate() && parsed <= bucketEnd.toDate())
                .map(({ item }) => item);

            series.push(project({
                label: formatDayBucketLabel(bucketStart),
                fullLabel: formatDayBucketTitle(bucketStart),
                start: bucketStart.toDate(),
                end: bucketEnd.toDate(),
                bucketItems,
            }));

            cursor = cursor.add(1, 'day');
        }
    } else if (mode === 'weekly') {
        let cursor = start.startOf('week');
        while (cursor.valueOf() <= end.endOf('day').valueOf()) {
            const bucketStart = cursor.startOf('day');
            const bucketEnd = cursor.add(6, 'day').endOf('day');
            const bucketItems = resolvedItems
                .filter(({ parsed }) => parsed >= bucketStart.toDate() && parsed <= bucketEnd.toDate())
                .map(({ item }) => item);

            const labelStr = `${bucketStart.format('MMM D')}`;
            const fullLabelStr = `${bucketStart.format('MMM D, YYYY')} – ${bucketEnd.format('MMM D, YYYY')}`;

            series.push(project({
                label: labelStr,
                fullLabel: fullLabelStr,
                start: bucketStart.toDate(),
                end: bucketEnd.toDate(),
                bucketItems,
            }));

            cursor = cursor.add(1, 'week');
        }
    } else { // monthly
        let cursor = start.startOf('month');
        while (cursor.valueOf() <= end.endOf('day').valueOf()) {
            const bucketStart = cursor.startOf('month');
            const bucketEnd = cursor.endOf('month');
            const bucketItems = resolvedItems
                .filter(({ parsed }) => parsed >= bucketStart.toDate() && parsed <= bucketEnd.toDate())
                .map(({ item }) => item);

            const labelStr = bucketStart.format('MMM YYYY');
            const fullLabelStr = bucketStart.format('MMMM YYYY');

            series.push(project({
                label: labelStr,
                fullLabel: fullLabelStr,
                start: bucketStart.toDate(),
                end: bucketEnd.toDate(),
                bucketItems,
            }));

            cursor = cursor.add(1, 'month');
        }
    }

    return series;
};

export const buildStatusTrendSeries = ({ items = [], dateRange = { start: '', end: '' }, fallbackDays = 14 }) =>
    buildDailySeries({
        items,
        dateRange,
        resolveDate: getIncidentTimestamp,
        fallbackDays,
        project: ({ label, fullLabel, bucketItems }) => ({
            name: label,
            fullDate: fullLabel,
            pending: bucketItems.filter((incident) => incident.status === 'Pending').length,
            closed: bucketItems.filter((incident) => incident.status === 'Closed').length,
        }),
    });

export const buildCreationTrendSeries = ({ items = [], dateRange = { start: '', end: '' }, fallbackDays = 14 }) =>
    buildDailySeries({
        items,
        dateRange,
        resolveDate: getIncidentTimestamp,
        fallbackDays,
        project: ({ label, fullLabel, bucketItems }) => ({
            name: label,
            fullDate: fullLabel,
            created: bucketItems.length,
            pending: bucketItems.filter((incident) => incident.status === 'Pending').length,
            closed: bucketItems.filter((incident) => incident.status === 'Closed').length,
        }),
    });

export const buildTrendSeriesFromBuckets = ({ buckets = [], dateRange = { start: '', end: '' }, fallbackDays = 14 }) => {
    const normalizedBuckets = buckets
        .map((bucket) => {
            const parsed = parseLocalDateParam(bucket?.date);
            return parsed ? { ...bucket, parsed } : null;
        })
        .filter(Boolean);
    const windowRange = resolveDailyWindow(normalizedBuckets, dateRange, fallbackDays);
    if (!windowRange?.start?.isValid?.() || !windowRange?.end?.isValid?.() || windowRange.start.valueOf() > windowRange.end.valueOf()) {
        return { statusTrendData: [], creationTrendData: [] };
    }

    const start = windowRange.start;
    const end = windowRange.end;
    const durationDays = end.diff(start, 'day') + 1;

    let mode = 'daily';
    if (durationDays > 30 && durationDays <= 90) {
        mode = 'weekly';
    } else if (durationDays > 90) {
        mode = 'monthly';
    }

    const statusTrendData = [];
    const creationTrendData = [];

    if (mode === 'daily') {
        const bucketMap = new Map(normalizedBuckets.map((bucket) => [normalizeDateParam(bucket.date), bucket]));
        let cursor = start.startOf('day');
        while (cursor.valueOf() <= end.endOf('day').valueOf()) {
            const bucket = bucketMap.get(cursor.format('YYYY-MM-DD')) || {};
            const shared = { name: formatDayBucketLabel(cursor), fullDate: formatDayBucketTitle(cursor) };
            const pendingCount = Number(bucket.pending || bucket.open || 0);
            const closedCount = Number(bucket.closed || 0);
            const createdCount = Number(bucket.created || 0);

            statusTrendData.push({
                ...shared,
                pending: pendingCount,
                closed: closedCount,
            });
            creationTrendData.push({
                ...shared,
                created: createdCount,
                pending: pendingCount,
                closed: closedCount,
            });
            cursor = cursor.add(1, 'day');
        }
    } else if (mode === 'weekly') {
        let cursor = start.startOf('week');
        while (cursor.valueOf() <= end.endOf('day').valueOf()) {
            const bucketStart = cursor.startOf('day');
            const bucketEnd = cursor.add(6, 'day').endOf('day');

            const weekBuckets = normalizedBuckets.filter(
                (bucket) => bucket.parsed >= bucketStart.toDate() && bucket.parsed <= bucketEnd.toDate()
            );

            let pending = 0;
            let closed = 0;
            let created = 0;
            weekBuckets.forEach((b) => {
                pending += Number(b.pending || b.open || 0);
                closed += Number(b.closed || 0);
                created += Number(b.created || 0);
            });

            const shared = {
                name: `${bucketStart.format('MMM D')}`,
                fullDate: `${bucketStart.format('MMM D, YYYY')} – ${bucketEnd.format('MMM D, YYYY')}`,
            };

            statusTrendData.push({ ...shared, pending, closed });
            creationTrendData.push({ ...shared, created, pending, closed });

            cursor = cursor.add(1, 'week');
        }
    } else { // monthly
        let cursor = start.startOf('month');
        while (cursor.valueOf() <= end.endOf('day').valueOf()) {
            const bucketStart = cursor.startOf('month');
            const bucketEnd = cursor.endOf('month');

            const monthBuckets = normalizedBuckets.filter(
                (bucket) => bucket.parsed >= bucketStart.toDate() && bucket.parsed <= bucketEnd.toDate()
            );

            let pending = 0;
            let closed = 0;
            let created = 0;
            monthBuckets.forEach((b) => {
                pending += Number(b.pending || b.open || 0);
                closed += Number(b.closed || 0);
                created += Number(b.created || 0);
            });

            const shared = {
                name: bucketStart.format('MMM YYYY'),
                fullDate: bucketStart.format('MMMM YYYY'),
            };

            statusTrendData.push({ ...shared, pending, closed });
            creationTrendData.push({ ...shared, created, pending, closed });

            cursor = cursor.add(1, 'month');
        }
    }

    return { statusTrendData, creationTrendData };
};
export const formatDisplayValue = (val) => {
    const raw = String(val || '').trim();
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
    if (!/[a-zA-Z]/.test(raw)) return raw;

    const withSpaces = raw.replace(/[_-]+/g, ' ');
    return withSpaces.replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Reusable utility to filter sections by selected class(es) based on class-section map.
 * @param {string|string[]} selectedClass - String (single) or Array (multi) of selected class(es)
 * @param {string[]} allSections - Fallback list of sections
 * @param {Object} classSectionMap - Map of class to its sections
 * @returns {string[]} Filtered sections list
 */
export const getFilteredSections = (selectedClass, allSections = [], classSectionMap = {}) => {
    if (!selectedClass || (Array.isArray(selectedClass) && selectedClass.length === 0)) {
        return allSections;
    }
    if (!classSectionMap || Object.keys(classSectionMap).length === 0) {
        return allSections;
    }
    const classesToCheck = Array.isArray(selectedClass) ? selectedClass : [selectedClass];
    const sectionsSet = new Set();
    classesToCheck.forEach((cls) => {
        const secs = classSectionMap[cls] || [];
        secs.forEach((sec) => sectionsSet.add(sec));
    });
    return Array.from(sectionsSet).sort();
};
