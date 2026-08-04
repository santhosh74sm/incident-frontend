import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../config/apiClient';
import dayjs from 'dayjs';
import { buildAcademicYearOptions, formatActivityRecordLabel } from '../utils/analytics';
import { UnifiedDateInput, UnifiedFilterBar, UnifiedSearchInput } from '../components/UnifiedFilters';
import { DashboardHero } from '../components/analytics/DashboardPrimitives';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmProvider';
import { useToast } from '../components/ToastProvider';
import {
    AlertTriangle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Eye,
    FilePlus,
    Hand,
    PencilLine,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
    UserRound,
    XCircle,
} from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 20];

const EMPTY_FILTERS = {
    start: '',
    end: '',
    entityType: '',
    academicYear: '',
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';
const isObjectIdLike = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value.trim());

const formatLabel = (value = '') =>
    String(value)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());

const formatPrimitiveValue = (value) => {
    if (value === null || value === undefined || value === '') return 'Not recorded';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) {
        return value.length === 0 ? 'Not recorded' : value.map((item) => formatPrimitiveValue(item)).join(', ');
    }
    if (typeof value === 'object') return null;
    if (isObjectIdLike(String(value))) return 'Reference unavailable';
    return String(value);
};

const getActionPresentation = (actionName = '') => {
    const normalized = actionName.toLowerCase();

    if (normalized.includes('delete') || normalized.includes('remove')) {
        return {
            tone: 'DELETED',
            icon: Trash2,
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 ',
            iconClass: 'text-rose-600 bg-rose-50 border-rose-200 ',
        };
    }

    if (normalized.includes('manual') || normalized.includes('custom timing')) {
        return {
            tone: 'MANUAL',
            icon: Hand,
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 ',
            iconClass: 'text-amber-600 bg-amber-50 border-amber-200 ',
        };
    }

    if (normalized.includes('update') || normalized.includes('edit') || normalized.includes('generate') || normalized.includes('upload')) {
        return {
            tone: normalized.includes('generate') ? 'GENERATED' : 'UPDATED',
            icon: PencilLine,
            badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 ',
            iconClass: 'text-blue-600 bg-blue-50 border-blue-200 ',
        };
    }

    if (normalized.includes('create') || normalized.includes('register') || normalized.includes('add')) {
        return {
            tone: 'CREATED',
            icon: FilePlus,
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 ',
            iconClass: 'text-emerald-600 bg-emerald-50 border-emerald-200 ',
        };
    }

    return {
        tone: 'ACTIVITY',
        icon: ShieldCheck,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 ',
        iconClass: 'text-slate-600 bg-slate-50 border-slate-200 ',
    };
};

const getTargetEntity = (log) => {
    const primaryLabel =
        log?.targetLabel ||
        log?.targetEntityLabel ||
        log?.metadata?.targetLabel ||
        log?.metadata?.Name ||
        log?.metadata?.name ||
        log?.metadata?.Title ||
        log?.metadata?.title ||
        log?.metadata?.label ||
        log?.metadata?.displayName ||
        log?.metadata?.studentName ||
        log?.metadata?.templateName ||
        log?.metadata?.letterNumber ||
        'Record unavailable';

    const admissionNumber =
        log?.targetAdmissionNumber ||
        log?.metadata?.['Admission Number'] ||
        log?.metadata?.admissionNo ||
        null;

    return {
        label: isObjectIdLike(String(primaryLabel)) ? 'Record unavailable' : primaryLabel,
        admissionNumber,
    };
};

const getSummaryDetails = (log) => {
    const metadata = isPlainObject(log?.metadata) ? log.metadata : {};
    const ignoredKeys = new Set(['before', 'after', 'schoolId', 'routePath', 'incidentId', 'targetLabel']);

    return Object.entries(metadata).filter(([key]) => !ignoredKeys.has(key));
};

const MetadataField = ({ label, value, depth = 0 }) => {
    const primitive = formatPrimitiveValue(value);

    if (primitive !== null) {
        return (
            <div className={`grid gap-1 ${depth === 0 ? 'sm:grid-cols-[180px_minmax(0,1fr)]' : 'sm:grid-cols-[140px_minmax(0,1fr)]'}`}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 ">{formatLabel(label)}</dt>
                <dd className="text-sm text-slate-700 break-words ">{primitive}</dd>
            </div>
        );
    }

    if (Array.isArray(value)) {
        return (
            <div className="space-y-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 ">{formatLabel(label)}</dt>
                <dd className="space-y-2">
                    {value.map((item, index) => (
                        <div key={`${label}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 ">
                            {isPlainObject(item) ? (
                                <dl className="space-y-3">
                                    {Object.entries(item).map(([nestedKey, nestedValue]) => (
                                        <MetadataField
                                            key={`${label}-${nestedKey}-${index}`}
                                            label={nestedKey}
                                            value={nestedValue}
                                            depth={depth + 1}
                                        />
                                    ))}
                                </dl>
                            ) : (
                                <p className="text-sm text-slate-700 ">{formatPrimitiveValue(item)}</p>
                            )}
                        </div>
                    ))}
                </dd>
            </div>
        );
    }

    if (isPlainObject(value)) {
        return (
            <div className="space-y-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 ">{formatLabel(label)}</dt>
                <dd className="rounded-xl border border-slate-200 bg-slate-50 p-4 ">
                    <dl className="space-y-3">
                        {Object.entries(value).map(([nestedKey, nestedValue]) => (
                            <MetadataField
                                key={`${label}-${nestedKey}`}
                                label={nestedKey}
                                value={nestedValue}
                                depth={depth + 1}
                            />
                        ))}
                    </dl>
                </dd>
            </div>
        );
    }

    return null;
};

const Logs = () => {
    const { user } = useAuth();
    const confirm = useConfirm();
    const { addToast } = useToast();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_SIZE_OPTIONS[0],
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
    });
    const [entityTypeOptions, setEntityTypeOptions] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const [expandedRowId, setExpandedRowId] = useState(null);
    const logsRequestRef = useRef({ controller: null, id: 0 });

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setPage(1);
        }, 300);

        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const fetchLogs = useCallback(async () => {
        if (!user?._id || !filters.academicYear) return;
        logsRequestRef.current.controller?.abort();
        const controller = new AbortController();
        const requestId = logsRequestRef.current.id + 1;
        logsRequestRef.current = { controller, id: requestId };
        const isCurrentRequest = () => logsRequestRef.current.id === requestId;

        setLoading(true);

        try {
            const params = {
                page,
                limit: pageSize,
            };

            if (debouncedSearch) params.search = debouncedSearch;
            if (filters.entityType) params.entityType = filters.entityType;
            params.academicYear = filters.academicYear;
            if (filters.start) params.startDate = filters.start;
            if (filters.end) params.endDate = filters.end;

            const { data } = await apiClient.get('/api/logs', {
                headers: {},
                params,
                signal: controller.signal,
            });
            if (!isCurrentRequest()) return;

            setLogs(Array.isArray(data?.logs) ? data.logs : []);
            setPagination(data?.pagination || {
                page,
                limit: pageSize,
                total: 0,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false,
            });
            const rawEntityTypes = Array.isArray(data?.filters?.entityTypes) ? data.filters.entityTypes : [];
            setEntityTypeOptions(
                Array.isArray(data?.filters?.entityTypeOptions)
                    ? data.filters.entityTypeOptions
                    : rawEntityTypes.map((entityType) => ({
                        value: entityType,
                        label: formatActivityRecordLabel(entityType),
                    }))
            );
            setAcademicYears((current) => {
                const fromResponse = Array.isArray(data?.filters?.academicYears) ? data.filters.academicYears : [];
                return fromResponse.length > 0 ? fromResponse : current;
            });
        } catch (error) {
            if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
            if (!isCurrentRequest()) return;
            setLogs([]);
            setPagination((current) => ({
                ...current,
                total: 0,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false,
            }));
        } finally {
            if (isCurrentRequest()) {
                setLoading(false);
            }
        }
    }, [debouncedSearch, filters.academicYear, filters.end, filters.entityType, filters.start, page, pageSize, user?._id]);

    useEffect(() => () => {
        logsRequestRef.current.controller?.abort();
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        if (!user?._id) return;

        let isMounted = true;

        const loadAcademicYears = async () => {
            try {
                const { data } = await apiClient.get('/api/auth/academic-years', {
                    headers: {},
                });
                if (!isMounted) return;

                const years = Array.isArray(data?.academicYears) ? data.academicYears : [];
                const currentYear = data?.currentAcademicYear || years[0] || '';

                setAcademicYears(years);
                setCurrentAcademicYear(currentYear);
                setFilters((current) => ({
                    ...current,
                    academicYear: current.academicYear || currentYear,
                }));
            } catch {
                if (!isMounted) return;
                setAcademicYears([]);
                setCurrentAcademicYear('');
            }
        };

        loadAcademicYears();

        return () => {
            isMounted = false;
        };
    }, [user?._id]);

    useEffect(() => {
        setExpandedRowId(null);
    }, [page, pageSize, debouncedSearch, filters.entityType, filters.academicYear, filters.start, filters.end]);

    const handleClearAll = async () => {
        const confirmed = await confirm({
            tone: 'danger',
            title: 'Clear Activity History',
            description: 'This will permanently delete all activity history for this school workspace. This action cannot be undone.',
            confirmLabel: 'Clear History',
        });
        if (!confirmed) return;

        try {
            await apiClient.delete('/api/logs', {
                headers: {},
            });
            setExpandedRowId(null);
            fetchLogs();
            addToast('Activity history cleared successfully.', 'success');
        } catch (error) {
            addToast('Unable to clear activity history right now.', 'error');
        }
    };

    const resetFilters = () => {
        setSearchInput('');
        setDebouncedSearch('');
        setFilters({ ...EMPTY_FILTERS, academicYear: currentAcademicYear });
        setPage(1);
        setExpandedRowId(null);
    };

    const activeFilterCount = useMemo(() => {
        return [
            debouncedSearch,
            filters.entityType,
            filters.academicYear && filters.academicYear !== currentAcademicYear ? filters.academicYear : '',
            filters.start,
            filters.end,
        ].filter(Boolean).length;
    }, [currentAcademicYear, debouncedSearch, filters.academicYear, filters.end, filters.entityType, filters.start]);

    const academicYearOptions = useMemo(
        () => buildAcademicYearOptions(academicYears, currentAcademicYear),
        [academicYears, currentAcademicYear]
    );
    const showingFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const showingTo = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="flex min-h-screen bg-slate-100 ">
            <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="mx-auto max-w-[1600px] space-y-6">
                        <DashboardHero
                            eyebrow="Activity history"
                            title="School Activity History"
                            description="Review school activity logs."
                            icon={ShieldCheck}
                            actions={(
                                <>
                                    <button
                                        type="button"
                                        onClick={fetchLogs}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-all duration-300 hover:bg-blue-50 "
                                    >
                                        <RefreshCw size={16} aria-hidden="true" />
                                        Refresh
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearAll}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Trash2 size={16} aria-hidden="true" />
                                        Clear History
                                    </button>
                                </>
                            )}
                        />

                        <UnifiedFilterBar hasActiveFilters={activeFilterCount > 0} onReset={resetFilters} title="Find & Filter" collapsible defaultCollapsed>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                                <div className="md:col-span-2">
                                    <UnifiedSearchInput
                                        label="Search"
                                        value={searchInput}
                                        onChange={setSearchInput}
                                        placeholder="Action, staff name, or admission number…"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 ">
                                        Record Type
                                    </label>
                                    <select
                                        value={filters.entityType}
                                        onChange={(event) => {
                                            setFilters((current) => ({ ...current, entityType: event.target.value }));
                                            setPage(1);
                                        }}
                                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition-all outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus-visible:outline-none"
                                    >
                                        <option value="">All record types</option>
                                        {entityTypeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 ">
                                        Academic Year
                                    </label>
                                    <select
                                        value={filters.academicYear}
                                        onChange={(event) => {
                                            setFilters((current) => ({ ...current, academicYear: event.target.value }));
                                            setPage(1);
                                        }}
                                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition-all outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus-visible:outline-none"
                                    >
                                        {academicYearOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 ">
                                        Rows Per Page
                                    </label>
                                    <select
                                        value={pageSize}
                                        onChange={(event) => {
                                            setPageSize(Number(event.target.value));
                                            setPage(1);
                                        }}
                                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition-all outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus-visible:outline-none"
                                    >
                                        {PAGE_SIZE_OPTIONS.map((size) => (
                                            <option key={size} value={size}>
                                                {size} rows
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
                                <UnifiedDateInput
                                    label="Start Date"
                                    value={filters.start}
                                    onChange={(value) => {
                                        setFilters((current) => ({ ...current, start: value }));
                                        setPage(1);
                                    }}
                                />
                                <UnifiedDateInput
                                    label="End Date"
                                    value={filters.end}
                                    onChange={(value) => {
                                        setFilters((current) => ({ ...current, end: value }));
                                        setPage(1);
                                    }}
                                />
                            </div>
                        </UnifiedFilterBar>

                        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ">
                            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 ">Activity Records</h2>
                                    <p className="text-sm text-slate-500 ">
                                        Showing {showingFrom}–{showingTo} of {pagination.total} activity entries
                                    </p>
                                </div>
                                {loading && (
                                    <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 ">
                                        <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
                                        Loading…
                                    </div>
                                )}
                            </div>

                            {logs.length === 0 && !loading ? (
                                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                                    <div className="relative mb-6">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 ">
                                            <Search size={30} className="text-slate-400" />
                                        </div>
                                        <div className="absolute -right-2 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200 ">
                                            <XCircle size={16} className="text-slate-300" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 ">No activity found.</h3>
                                    <p className="mt-2 max-w-md text-sm text-slate-500 ">
                                        No entries match these filters.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                    >
                                        <RefreshCw size={16} aria-hidden="true" />
                                        Clear Filters
                                    </button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-[980px] w-full">
                                        <thead className="bg-slate-50 ">
                                            <tr className="border-b border-slate-200 ">
                                                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ">Action</th>
                                                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ">Performed By</th>
                                                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ">Related Record</th>
                                                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ">Date & Time</th>
                                                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {logs.map((log) => {
                                                const presentation = getActionPresentation(log.actionName);
                                                const Icon = presentation.icon;
                                                const target = getTargetEntity(log);
                                                const summaryDetails = getSummaryDetails(log);
                                                const isExpanded = expandedRowId === log._id;
                                                const beforeChanges = isPlainObject(log?.metadata?.before) ? log.metadata.before : null;
                                                const afterChanges = isPlainObject(log?.metadata?.after) ? log.metadata.after : null;

                                                return (
                                                    <React.Fragment key={log._id}>
                                                        <tr className="border-b border-slate-100 transition hover:bg-slate-50/80 ">
                                                            <td className="px-5 py-4 align-top">
                                                                <div className="flex items-start gap-3">
                                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${presentation.iconClass}`}>
                                                                        <Icon size={18} />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <p className="font-semibold text-slate-900 ">{formatLabel(log.actionName)}</p>
                                                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${presentation.badgeClass}`}>
                                                                            {presentation.tone}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 align-top">
                                                                <div className="space-y-2">
                                                                    <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 ">
                                                                        <UserRound size={14} className="text-slate-500" />
                                                                        {log.performedByName || 'System'}
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 ">
                                                                        {log.performedByRole || 'Role unavailable'}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 align-top">
                                                                <div className="space-y-2">
                                                                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 ">
                                                                        {log.displayEntityType || formatActivityRecordLabel(log.entityType)}
                                                                    </span>
                                                                    <p className="text-sm font-semibold text-slate-800 ">{target.label}</p>
                                                                    {target.admissionNumber && (
                                                                        <p className="text-xs text-slate-500 ">Admission Number: {target.admissionNumber}</p>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 align-top">
                                                                <div className="space-y-1">
                                                                    <p className="text-sm font-semibold text-slate-800 ">
                                                                        {dayjs(log.createdAt).format('DD MMM YYYY')}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 ">
                                                                        {dayjs(log.createdAt).format('hh:mm A')}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                            <td className="px-5 py-4 align-top">
                                                                <div className="space-y-3">
                                                                    <p className="max-w-md text-sm text-slate-600 ">
                                                                        {summaryDetails.length > 0
                                                                            ? summaryDetails
                                                                                .slice(0, 2)
                                                                                .map(([key, value]) => `${formatLabel(key)}: ${formatPrimitiveValue(value) || 'See details'}`)
                                                                                .join(' - ')
                                                                            : 'Open details for full information.'}
                                                                    </p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedRowId(isExpanded ? null : log._id)}
                                                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                                        aria-expanded={isExpanded}
                                                                        aria-label={isExpanded ? `Hide details for ${formatLabel(log.actionName)}` : `View details for ${formatLabel(log.actionName)}`}
                                                                    >
                                                                        <Eye size={14} aria-hidden="true" />
                                                                        {isExpanded ? 'Hide Details' : 'View Details'}
                                                                        <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="border-b border-slate-100 bg-slate-50/70 ">
                                                                <td colSpan={5} className="px-5 py-5">
                                                                    <div className="grid gap-4 xl:grid-cols-3">
                                                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
                                                                            <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500 ">Summary</h3>
                                                                            <dl className="space-y-3">
                                                                                <MetadataField label="Action" value={formatLabel(log.actionName)} />
                                                                                <MetadataField label="Performed By" value={log.performedByName || log.performedBy} />
                                                                                <MetadataField label="Record Information" value={log.displayEntityType || formatActivityRecordLabel(log.entityType)} />
                                                                                <MetadataField label="Related Record" value={target.label} />
                                                                                <MetadataField label="Recorded At" value={dayjs(log.createdAt).format('DD MMM YYYY, hh:mm:ss A')} />
                                                                            </dl>
                                                                        </div>

                                                                        <div className="space-y-4 xl:col-span-2">
                                                                            {(beforeChanges || afterChanges) && (
                                                                                <div className="grid gap-4 lg:grid-cols-2">
                                                                                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 ">
                                                                                        <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-amber-700 ">Before</h3>
                                                                                        {beforeChanges ? (
                                                                                            <dl className="space-y-3">
                                                                                                {Object.entries(beforeChanges).map(([key, value]) => (
                                                                                                    <MetadataField key={`before-${key}`} label={key} value={value} />
                                                                                                ))}
                                                                                            </dl>
                                                                                        ) : (
                                                                                            <p className="text-sm text-amber-700/80 ">No previous values were captured for this action.</p>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 ">
                                                                                        <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700 ">After</h3>
                                                                                        {afterChanges ? (
                                                                                            <dl className="space-y-3">
                                                                                                {Object.entries(afterChanges).map(([key, value]) => (
                                                                                                    <MetadataField key={`after-${key}`} label={key} value={value} />
                                                                                                ))}
                                                                                            </dl>
                                                                                        ) : (
                                                                                            <p className="text-sm text-emerald-700/80 ">No updated values were captured for this action.</p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ">
                                                                                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500 ">Extra Information</h3>
                                                                                {summaryDetails.length > 0 ? (
                                                                                    <dl className="space-y-3">
                                                                                        {summaryDetails.map(([key, value]) => (
                                                                                            <MetadataField key={`meta-${key}`} label={key} value={value} />
                                                                                        ))}
                                                                                    </dl>
                                                                                ) : (
                                                                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 ">
                                                                                        No additional details were saved for this activity.
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                <p className="text-sm text-slate-500 ">
                                    {pagination.total > 0
                                        ? `Showing ${showingFrom}–${showingTo} of ${pagination.total} entries`
                                        : 'No entries to display.'}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                                        disabled={!pagination.hasPrevPage || loading}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                    >
                                        <ChevronLeft size={16} aria-hidden="true" />
                                        Previous
                                    </button>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 ">
                                        Page {pagination.page} / {pagination.totalPages}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPage((current) => current + 1)}
                                        disabled={!pagination.hasNextPage || loading}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                    >
                                        Next
                                        <ChevronRight size={16} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-sm ">
                            <div className="flex items-start gap-3">
                                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                                <p>
                                    Activity is loaded page by page. Search and filters run first, then results are split into pages so the screen stays fast even with long histories.
                                </p>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Logs;
