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
    { id: 'Open', label: 'Open' },
    { id: 'In Progress', label: 'In progress' },
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
    Open: '#f97316',
    'In Progress': '#3b82f6',
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

export const resolveHandlerLabel = (incident) => {
    const handler = incident?.assignedHandler;
    if (!handler) return 'Admin';
    const role = handler.role || '';
    if (['Super Admin', 'Admin', 'super_admin', 'admin'].includes(role)) return 'Admin';
    return handler.name || 'Admin';
};

export const toneForStatus = (status) => {
    if (status === 'Closed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'In Progress') return 'bg-blue-50 text-blue-700 border-blue-200';
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
                    : incident.status === 'In Progress'
                      ? icons.inProgress
                      : icons.open,
            tone: incident.status === 'Closed' ? 'emerald' : incident.status === 'In Progress' ? 'blue' : 'amber',
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
        const fallbackStart = latest.startOf('day').subtract(fallbackDays - 1, 'day');

        return {
            start: fallbackStart.valueOf() > earliest.valueOf() ? fallbackStart : earliest,
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

    const series = [];
    let cursor = windowRange.start.startOf('day');
    const end = windowRange.end.endOf('day');

    while (cursor.valueOf() <= end.valueOf()) {
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
            open: bucketItems.filter((incident) => incident.status === 'Open').length,
            inProgress: bucketItems.filter((incident) => incident.status === 'In Progress').length,
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
        }),
    });
export const formatDisplayValue = (val) => {
    const raw = String(val || '').trim();
    if (!raw) return '';
    if (raw.includes('@')) return raw;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
    if (!/[a-zA-Z]/.test(raw)) return raw;

    const withSpaces = raw.replace(/[_-]+/g, ' ');
    return withSpaces.replace(/\b\w/g, (char) => char.toUpperCase());
};
