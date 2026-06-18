import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../config/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Eye,
    FileDown,
    Hash,
    Layers3,
    Loader2,
    Mail,
    RefreshCw,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import {
    UnifiedDateInput,
    UnifiedFilterBar,
    UnifiedMultiSelect,
    UnifiedSearchInput,
} from '../components/UnifiedFilters';
import {
    buildIssuedLetterFilterParams,
    buildAcademicYearOptions,
    formatShortDateTime,
    getLetterTimelineTimestamp,
} from '../utils/analytics';
import { downloadBlob } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';
import BulkDeleteControls from '../components/BulkDeleteControls';
import { isAdminRole, isSuperAdminRole } from '../utils/roles';

const PAGE_SIZE = 10;

const sanitizeFilename = (value = 'letter') =>
    String(value)
        .trim()
        .replace(/[^a-zA-Z0-9.-]/g, '_');

const getTimelineSource = (letter) => {
    if (letter?.incident?.incidentDate) return 'Incident date';
    if (letter?.incident?.openedAt) return 'Opened';
    if (letter?.incident?.createdAt) return 'Recorded';
    if (letter?.incident?.submittedAt) return 'Submitted';
    return 'Letter issued';
};

const buildLetterFilename = (letter, extension) =>
    [
        sanitizeFilename(letter?.title || 'Incident_Letter'),
        sanitizeFilename(letter?.className || 'Class'),
        sanitizeFilename(letter?.section || 'Section'),
        sanitizeFilename(letter?.studentName || 'Student'),
        sanitizeFilename(letter?.admissionNo || '00000'),
    ].join('_') + `.${extension}`;

const SummaryCard = ({ label, value, description, tone = 'slate' }) => {
    const tones = {
        slate: 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100',
        blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-100',
        amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100',
        emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100',
    };

    return (
        <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const styles = {
        Issued: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-200',
        Printed: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200',
        Sent: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200',
        'Successfully Issued': 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200',
    };

    return (
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${styles[status] || styles.Issued}`}>
            {status || 'Issued'}
        </span>
    );
};

const ActionIconButton = ({ icon: Icon, label, ...props }) => (
    <button
        type="button"
        title={label}
        aria-label={label}
        className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        {...props}
    >
        <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
);

const DetailModal = ({
    letter,
    downloadingDocx,
    onClose,
    onDownloadDocx,
    onDelete,
}) => {
    if (!letter) return null;

    const timelineValue = getLetterTimelineTimestamp(letter);

    return (
        <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
            <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-4xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Issued letter</p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{letter.title || 'Incident Letter'}</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            Reference {letter.letterNumber || 'N/A'} - {letter.studentName || 'Student'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.2fr)_340px]">
                    <div className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Student</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">{letter.studentName || 'N/A'}</p>
                                <p className="mt-1 text-sm text-slate-500">Admission No: {letter.admissionNo || 'N/A'}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Class details</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">
                                    Class {letter.className || 'N/A'} - {letter.section || 'N/A'}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">{letter.incidentCategory || 'No category'}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Incident timeline</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">{formatShortDateTime(timelineValue)}</p>
                                <p className="mt-1 text-sm text-slate-500">{getTimelineSource(letter)}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Issued date</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">{formatShortDateTime(letter.generatedAt)}</p>
                                <p className="mt-1 text-sm text-slate-500">Language: {letter.language === 'ta' ? 'Tamil' : 'English'}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Academic Year</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900">{letter.academicYear || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Incident snapshot</h3>
                                    <p className="mt-1 text-sm text-slate-500">Details from the related incident.</p>
                                </div>
                                <StatusBadge status={letter.status} />
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Incident title</p>
                                    <p className="mt-2 text-sm font-medium text-slate-900">{letter.incident?.title || 'N/A'}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Location</p>
                                    <p className="mt-2 text-sm font-medium text-slate-900">{letter.incident?.location || 'N/A'}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Description</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-700">{letter.incident?.description || 'No description available.'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</p>
                            <h3 className="mt-2 text-lg font-semibold text-slate-900">Save or remove</h3>
                            <p className="mt-1 text-sm text-slate-500">Saving and removal only affect the saved letter record here.</p>
                        </div>

                        <button
                            type="button"
                            onClick={onDownloadDocx}
                            disabled={downloadingDocx}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-700 bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {downloadingDocx ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            Download Word file
                        </button>

                        <button
                            type="button"
                            onClick={onDelete}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete record
                        </button>
                    </aside>
                </div>
            </div>
        </div>
    );
};

const DeleteModal = ({ letter, deleting, onClose, onConfirm }) => {
    if (!letter) return null;

    return (
        <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4">
            <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-md overflow-y-auto rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:rounded-3xl">
                <div className="border-b border-slate-200 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-2 text-rose-700">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900">Delete letter record</h2>
                    </div>
                </div>
                <div className="px-6 py-6">
                    <p className="text-sm leading-6 text-slate-600">
                        Delete <span className="font-semibold text-slate-900">{letter.letterNumber}</span> for{' '}
                        <span className="font-semibold text-slate-900">{letter.studentName}</span>. This removes the issued letter record and cannot be undone.
                    </p>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={deleting}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-700 bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

const MobileLetterCard = ({ letter, timelineValue, downloading, onView, onDownload, onDelete }) => (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Hash className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{letter?.letterNumber || 'N/A'}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{letter?.title || 'Incident Letter'}</p>
            </div>
            <StatusBadge status={letter?.status} />
        </div>

        <div className="mt-4 grid gap-3 text-sm">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Student</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{letter?.studentName || 'N/A'}</p>
                <p className="text-slate-500 dark:text-slate-400">Admission No: {letter?.admissionNo || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Class</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                        {letter?.className || 'N/A'} - {letter?.section || 'N/A'}
                    </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Language</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{letter?.language === 'ta' ? 'Tamil' : 'English'}</p>
                </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Category</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{letter?.incidentCategory || 'N/A'}</p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">{letter?.incident?.title || 'No incident title on file'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Timeline</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatShortDateTime(timelineValue)}</p>
                    <p className="text-slate-500 dark:text-slate-400">{getTimelineSource(letter)}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Issued</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatShortDateTime(letter?.generatedAt)}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Academic Year</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{letter?.academicYear || 'N/A'}</p>
                </div>
            </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
            <ActionIconButton icon={Eye} label="View record" onClick={onView} />
            <ActionIconButton icon={FileDown} label="Download Word file" onClick={onDownload} disabled={downloading} />
            <ActionIconButton icon={Trash2} label="Delete record" onClick={onDelete} />
        </div>
    </article>
);

const IssuedLetters = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [letters, setLetters] = useState([]);
    const [availableCategories, setAvailableCategories] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]);
    const [availableSections, setAvailableSections] = useState([]);
    const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [filters, setFilters] = useState({ categories: [], classes: [], sections: [], academicYear: '' });
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');
    const [page, setPage] = useState(1);
    const [selectedLetter, setSelectedLetter] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [downloadingKey, setDownloadingKey] = useState('');
    const hasLoadedLettersRef = useRef(false);

    const config = useMemo(() => ({ headers: {} }), []);
    const isSuperAdmin = isSuperAdminRole(user?.role);
    const academicYearOptions = useMemo(
        () => buildAcademicYearOptions(availableAcademicYears, currentAcademicYear),
        [availableAcademicYears, currentAcademicYear]
    );

    const fetchFilters = useCallback(async () => {
        if (!user?._id) return;

        try {
            const [response, yearResponse] = await Promise.all([
                apiClient.get('/api/issued-letters/filters', config),
                apiClient.get('/api/auth/academic-years', config),
            ]);
            setAvailableCategories(response.data?.categories || []);
            setAvailableClasses(response.data?.classes || []);
            setAvailableSections(response.data?.sections || []);
            setAvailableAcademicYears([...new Set([
                ...(yearResponse.data?.academicYears || []),
                ...(response.data?.academicYears || []),
            ])].sort());
            setCurrentAcademicYear(yearResponse.data?.currentAcademicYear || '');
            setFilters((current) => ({
                ...current,
                academicYear: current.academicYear || yearResponse.data?.currentAcademicYear || response.data?.academicYears?.[response.data.academicYears.length - 1] || '',
            }));
        } catch (error) {
            addToast('Failed to load issued letter filters.', 'error');
        }
    }, [addToast, config, user?._id]);

    const fetchLetters = useCallback(async (showLoader = true) => {
        if (!user?._id) return;
        if (!filters.academicYear) return;

        try {
            if (showLoader && !hasLoadedLettersRef.current) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

            const params = buildIssuedLetterFilterParams({
                dateRange,
                incidentCategories: filters.categories,
            });

            if (filters.classes?.length > 0) params.append('class', filters.classes.join(','));
            if (filters.sections?.length > 0) params.append('section', filters.sections.join(','));
            if (filters.academicYear) params.set('academicYear', filters.academicYear);

            const requestConfig = params.toString() ? { ...config, params } : config;
            const response = await apiClient.get('/api/issued-letters', requestConfig);

            setLetters(response.data || []);
        } catch (error) {
            addToast(error.response?.data?.message || 'Failed to load issued letters.', 'error');
        } finally {
            hasLoadedLettersRef.current = true;
            setLoading(false);
            setRefreshing(false);
        }
    }, [addToast, config, dateRange, filters.academicYear, filters.categories, filters.classes, filters.sections, user?._id]);

    useEffect(() => {
        fetchFilters();
    }, [fetchFilters]);

    useEffect(() => {
        fetchLetters();
    }, [fetchLetters]);

    useEffect(() => {
        setPage(1);
    }, [dateRange.end, dateRange.start, filters.academicYear, filters.categories, filters.classes, filters.sections, searchTerm]);

    const filteredLetters = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const nextLetters = [...letters].sort(
            (first, second) => new Date(second.generatedAt).getTime() - new Date(first.generatedAt).getTime()
        );

        if (!query) return nextLetters;

        return nextLetters.filter((letter) =>
            [letter.studentName, letter.admissionNo, letter.letterNumber, letter.incidentCategory, letter.title]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [letters, searchTerm]);

    const categorySummary = useMemo(() => {
        const categoryCounts = filteredLetters.reduce((accumulator, letter) => {
            const category = String(letter.incidentCategory || letter.incident?.category || 'Uncategorized').trim() || 'Uncategorized';
            accumulator[category] = (accumulator[category] || 0) + 1;
            return accumulator;
        }, {});

        return Object.entries(categoryCounts)
            .map(([category, count]) => ({ category, count }))
            .sort((first, second) => second.count - first.count || first.category.localeCompare(second.category));
    }, [filteredLetters]);

    const totalPages = Math.max(1, Math.ceil(filteredLetters.length / PAGE_SIZE));
    const paginatedLetters = filteredLetters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const clearFilters = () => {
        setSearchTerm('');
        setDateRange({ start: '', end: '' });
        setFilters({ categories: [], classes: [], sections: [], academicYear: currentAcademicYear });
    };

    const activeFilterCount =
        filters.categories.length + filters.classes.length + filters.sections.length + (filters.academicYear !== currentAcademicYear ? 1 : 0) + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0) + (searchTerm ? 1 : 0);

    const downloadLetter = async (letter) => {
        const loadingStateKey = `${letter?._id}-docx`;

        try {
            setDownloadingKey(loadingStateKey);

            const response = await apiClient.get(`/api/issued-letters/${letter?._id}/download`, {
                ...config,
                responseType: 'blob',
            });

            await withFeedback(
                addToast,
                () => downloadBlob(
                    new Blob([response.data]),
                    buildLetterFilename(letter, 'docx'),
                    { title: 'Issued letter' }
                ),
                {
                    successMessage: 'Letter downloaded successfully.',
                    errorMessage: 'Download failed.',
                }
            );
        } catch {
        } finally {
            setDownloadingKey('');
        }
    };

    const handleDeleteLetter = async () => {
        if (!deleteTarget) return;

        try {
            setDeleting(true);
            await apiClient.delete(`/api/issued-letters/${deleteTarget._id}`, config);
            setLetters((current) => current.filter((letter) => letter._id !== deleteTarget._id));
            setSelectedLetter((current) => (current?._id === deleteTarget._id ? null : current));
            setDeleteTarget(null);
            addToast('Issued letter deleted.');
        } catch (error) {
            addToast(error.response?.data?.message || 'Delete failed.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    if (!isAdminRole(user?.role)) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-700">
                Admin access is required to manage issued letters.
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">

            <div className="flex min-w-0 flex-1 flex-col">

                <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto flex max-w-[1700px] flex-col gap-6">
                        <section className="overflow-hidden rounded-[32px] border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white shadow-2xl shadow-slate-900/20">
                            <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-center lg:px-8">
                                <div>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                                        <Mail className="h-4 w-4" />
                                        Issued letters
                                    </div>
                                    <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                                        Generated Letters
                                    </h1>
                                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                                        View and manage issued letters.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        fetchFilters();
                                        fetchLetters(false);
                                    }}
                                    disabled={refreshing}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    Refresh
                                </button>
                            </div>
                        </section>

                        <section className="mb-6">
                            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Letters by category</h2>
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {categorySummary.length > 0 ? (
                                    categorySummary.map((item, index) => (
                                        <SummaryCard
                                            key={item.category}
                                            label={item.category}
                                            value={item.count}
                                            description={`${item.count === 1 ? 'Letter' : 'Letters'} after search and filters`}
                                            tone={['blue', 'emerald', 'amber', 'slate'][index % 4]}
                                        />
                                    ))
                                ) : (
                                    <SummaryCard
                                        label="No categories"
                                        value="0"
                                        description="No issued letters match the current filters"
                                    />
                                )}
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
                            <UnifiedFilterBar
                                title="Issued Letter Filters"
                                hasActiveFilters={activeFilterCount > 0}
                                onReset={clearFilters}
                            >
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
                                    <UnifiedSearchInput
                                        label="Search by Name / Ad No"
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Search student name, admission no, letter ref, or category..."
                                    />

                                    <label className="min-w-0">
                                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Academic Year</span>
                                        <select
                                            value={filters.academicYear}
                                            onChange={(event) => setFilters((current) => ({ ...current, academicYear: event.target.value }))}
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"
                                        >
                                            {academicYearOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>

                                    <UnifiedMultiSelect
                                        label="Class"
                                        options={availableClasses}
                                        selected={filters.classes}
                                        onChange={(value) => setFilters(current => ({ ...current, classes: value }))}
                                        placeholder="All Classes"
                                        searchPlaceholder="Search class..."
                                    />

                                    <UnifiedMultiSelect
                                        label="Section"
                                        options={availableSections}
                                        selected={filters.sections}
                                        onChange={(value) => setFilters(current => ({ ...current, sections: value }))}
                                        placeholder="All Sections"
                                        searchPlaceholder="Search section..."
                                    />

                                    <UnifiedMultiSelect
                                        label="Category"
                                        options={availableCategories}
                                        selected={filters.categories}
                                        onChange={(value) => setFilters(current => ({ ...current, categories: value }))}
                                        placeholder="All Categories"
                                        searchPlaceholder="Search category..."
                                    />

                                    <UnifiedDateInput
                                        label="Timeline From"
                                        value={dateRange.start}
                                        onChange={(value) => setDateRange((current) => ({ ...current, start: value }))}
                                    />

                                    <UnifiedDateInput
                                        label="Timeline To"
                                        value={dateRange.end}
                                        onChange={(value) => setDateRange((current) => ({ ...current, end: value }))}
                                    />
                                </div>

                                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                    Date filters follow the incident dates. The date the letter was issued stays in its own column for clarity.
                                </div>
                            </UnifiedFilterBar>
                        </section>

                        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Generated letters</h2>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                        Page {page} of {totalPages} — {filteredLetters.length} total result{filteredLetters.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {isSuperAdmin ? (
                                        <BulkDeleteControls
                                            moduleName="issued-letters"
                                            filteredIds={filteredLetters.map((letter) => letter._id).filter(Boolean)}
                                            allCount={letters.length}
                                            source={{ page: 'IssuedLetters', filteredCount: filteredLetters.length }}
                                            addToast={addToast}
                                            onComplete={() => {
                                                fetchLetters(false);
                                                fetchFilters();
                                            }}
                                        />
                                    ) : null}
                                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                        View · Download · Delete
                                    </div>
                                </div>
                            </div>

                            {loading && letters.length === 0 ? (
                                <div className="flex min-h-[420px] items-center justify-center">
                                    <div className="text-center">
                                        <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-500" />
                                        <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">Loading issued letters…</p>
                                    </div>
                                </div>
                            ) : filteredLetters.length === 0 ? (
                                <div className="px-6 py-16 text-center">
                                    <Mail className="mx-auto h-12 w-12 text-slate-300" />
                                    <h3 className="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-100">No letters found</h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        Try adjusting the search or clearing active filters to see more issued letter records.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-4 p-4 md:hidden">
                                        {paginatedLetters.map((letter) => {
                                            const timelineValue = getLetterTimelineTimestamp(letter);

                                            return (
                                                <MobileLetterCard
                                                    key={letter?._id}
                                                    letter={letter}
                                                    timelineValue={timelineValue}
                                                    downloading={downloadingKey === `${letter?._id}-docx`}
                                                    onView={() => setSelectedLetter(letter)}
                                                    onDownload={() => downloadLetter(letter)}
                                                    onDelete={() => setDeleteTarget(letter)}
                                                />
                                            );
                                        })}
                                    </div>

                                    <div className="-mx-1 hidden min-w-0 overflow-x-auto px-1 md:block sm:mx-0 sm:px-0">
                                        <table className="min-w-[1180px] w-full table-fixed divide-y divide-slate-200 dark:divide-slate-800">
                                            <thead className="bg-slate-50 dark:bg-slate-900/80">
                                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                    <th className="px-5 py-4">Letter Ref</th>
                                                    <th className="px-5 py-4">Student</th>
                                                    <th className="px-5 py-4">Category</th>
                                                    <th className="px-5 py-4">Incident Timeline</th>
                                                    <th className="px-5 py-4">Issued Date</th>
                                                    <th className="px-5 py-4">Status</th>
                                                    <th className="px-5 py-4 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {paginatedLetters.map((letter) => {
                                                    const timelineValue = getLetterTimelineTimestamp(letter);

                                                    return (
                                                        <tr key={letter._id} className="align-top transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                                                            <td data-label="Letter Ref" className="px-5 py-4 break-words align-top">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                                        <Hash className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                                                        {letter.letterNumber || 'N/A'}
                                                                    </div>
                                                                    <p className="text-sm text-slate-600 dark:text-slate-300">{letter.title || 'Incident Letter'}</p>
                                                                </div>
                                                            </td>
                                                            <td data-label="Student" className="px-5 py-4 break-words align-top">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                                        <UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                                                        {letter.studentName || 'N/A'}
                                                                    </div>
                                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Admission No: {letter.admissionNo || 'N/A'}</p>
                                                                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                        <Layers3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                                        Class {letter.className || 'N/A'} - {letter.section || 'N/A'}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td data-label="Category" className="px-5 py-4 break-words align-top">
                                                                <div className="space-y-2">
                                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{letter.incidentCategory || 'N/A'}</p>
                                                                    <p className="text-sm text-slate-500 dark:text-slate-400">{letter.incident?.title || 'No incident title on file'}</p>
                                                                </div>
                                                            </td>
                                                            <td data-label="Incident Timeline" className="px-5 py-4 break-words align-top">
                                                                <div className="space-y-1">
                                                                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                                        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                                                        {formatShortDateTime(timelineValue)}
                                                                    </div>
                                                                    <p className="text-sm text-slate-500 dark:text-slate-400">{getTimelineSource(letter)}</p>
                                                                </div>
                                                            </td>
                                                            <td data-label="Issued Date" className="px-5 py-4 break-words align-top">
                                                                <div className="space-y-1">
                                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatShortDateTime(letter.generatedAt)}</p>
                                                                    <p className="text-sm text-slate-500 dark:text-slate-400">{letter.language === 'ta' ? 'Tamil' : 'English'}</p>
                                                                </div>
                                                            </td>
                                                            <td data-label="Status" className="px-5 py-4 break-words align-top">
                                                                <StatusBadge status={letter.status} />
                                                            </td>
                                                            <td data-label="Action" className="px-5 py-4 break-words align-top">
                                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                                    <ActionIconButton
                                                                        icon={Eye}
                                                                        label="View record"
                                                                        onClick={() => setSelectedLetter(letter)}
                                                                    />
                                                                    <ActionIconButton
                                                                        icon={FileDown}
                                                                        label="Download Word file"
                                                                        onClick={() => downloadLetter(letter)}
                                                                        disabled={downloadingKey === `${letter?._id}-docx`}
                                                                    />
                                                                    <ActionIconButton
                                                                        icon={Trash2}
                                                                        label="Delete record"
                                                                        onClick={() => setDeleteTarget(letter)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Showing {(page - 1) * PAGE_SIZE + 1}–
                                            {Math.min(page * PAGE_SIZE, filteredLetters.length)} of {filteredLetters.length}
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                                                disabled={page === 1}
                                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                            >
                                                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                                Previous
                                            </button>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                {page} / {totalPages}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                                disabled={page === totalPages}
                                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                            >
                                                Next
                                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                </main>
            </div>

            <DetailModal
                letter={selectedLetter}
                downloadingDocx={downloadingKey === `${selectedLetter?._id}-docx`}
                onClose={() => setSelectedLetter(null)}
                onDownloadDocx={() => selectedLetter && downloadLetter(selectedLetter)}
                onDelete={() => {
                    setDeleteTarget(selectedLetter);
                    setSelectedLetter(null);
                }}
            />

            <DeleteModal
                letter={deleteTarget}
                deleting={deleting}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteLetter}
            />
        </div>
    );
};

export default IssuedLetters;
