import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { useNotifications } from '../context/NotificationContext';
import apiClient from '../config/apiClient';
import { API_BASE } from '../config/apiClient';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    Calendar,
    Check,
    CheckCircle,
    ChevronDown,
    Clock,
    Download,
    ExternalLink,
    FileImage,
    FilePlus,
    FileText,
    Loader2,
    Lock,
    Mail,
    MapPin,
    MessageSquare,
    Plus,
    PlusCircle,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    UploadCloud,
    UserCheck,
    UserPlus,
    Users,
    X,
    Zap,
} from 'lucide-react';
import {
    DashboardPanel,
    EmptyStatePanel,
} from '../components/analytics/DashboardPrimitives';
import { formatShortDate, formatShortDateTime, getIncidentTimestamp, resolveHandlerLabel, formatDisplayValue, resolveUserLabel } from '../utils/analytics';
import {
    migrateIncidentStorageForUser,
    readUserList,
    writeUserList,
} from '../utils/userStorage';
import { getRecordId, isValidMongoObjectId } from '../utils/ids';
import { downloadBlob, downloadRemoteFile, isNativeDownloadPlatform, openRemoteFile, parseDownloadFilename } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';
import { isAdminRole, isTeacherRole } from '../utils/roles';

const STATUS_STYLES = {
    Pending: { badge: 'border-orange-200 bg-orange-50 text-orange-700', tone: 'amber' },
    Closed: { badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', tone: 'emerald' },
};
const FIELD_CARD_CLASS =
    'incident-field-card rounded-lg border border-slate-200 bg-slate-50/70 p-4 shadow-sm shadow-slate-200/30 ';

const getStatusStyle = (status) =>
    STATUS_STYLES[status] || { badge: 'border-slate-200 bg-slate-50 text-slate-700', tone: 'slate' };

const slugify = (value, fallback = 'file') => {
    const normalized = String(value || fallback).trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    return normalized || fallback;
};

const resolveFileUrl = (value) => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    const normalized = String(value).replace(/\\/g, '/');
    const match = normalized.match(/(?:^|\/)api\/uploads\/(.+)$/i) || normalized.match(/(?:^|\/)uploads\/(.+)$/i);
    if (match) return `${API_BASE}/api/uploads/${match[1].replace(/^\/+/, '')}`;
    return `${API_BASE}/${normalized.replace(/^\/+/, '')}`;
};

const withEvidenceDisposition = (fileUrl, disposition) => {
    if (!fileUrl) return null;
    try {
        const url = new URL(fileUrl, API_BASE);
        url.searchParams.set('disposition', disposition);
        return url.toString();
    } catch {
        const separator = fileUrl.includes('?') ? '&' : '?';
        return `${fileUrl}${separator}disposition=${encodeURIComponent(disposition)}`;
    }
};

const getEvidenceFilename = (entry, fallback) => {
    if (entry?.originalName) return entry.originalName;

    const value = entry?.fileUrl;
    if (!value) return fallback;

    const normalized = String(value).replace(/\\/g, '/');
    if (/\/api\/uploads\/s3\//i.test(normalized)) return fallback;

    const rawName = normalized.split('?')[0].split('/').pop() || '';
    const decodedName = decodeURIComponent(rawName);

    return decodedName && !/^v1\./i.test(decodedName) ? decodedName : fallback;
};

const formatFileSize = (size = 0) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const evidencePreviewCache = new Map();

const subscribeToEvidencePreview = (src, callback) => {
    const cached = evidencePreviewCache.get(src);
    if (cached?.status === 'ready' || cached?.status === 'failed') {
        callback(cached);
        return () => {};
    }

    if (cached?.status === 'loading') {
        cached.subscribers.add(callback);
        return () => cached.subscribers.delete(callback);
    }

    const entry = {
        status: 'loading',
        objectUrl: '',
        previewType: '',
        subscribers: new Set([callback]),
    };
    evidencePreviewCache.set(src, entry);

    apiClient.get(src, {
        responseType: 'blob',
        headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,application/pdf,*/*;q=0.8' },
    }).then((response) => {
        const contentType = String(response.headers?.['content-type'] || response.data?.type || '').toLowerCase();
        const canPreviewImage = contentType.startsWith('image/');
        const canPreviewPdf = contentType.startsWith('application/pdf');

        if (!canPreviewImage && !canPreviewPdf) {
            throw new Error('Preview response was not an image or PDF.');
        }

        entry.status = 'ready';
        entry.previewType = canPreviewPdf ? 'pdf' : 'image';
        entry.objectUrl = window.URL.createObjectURL(response.data);
    }).catch(() => {
        entry.status = 'failed';
    }).finally(() => {
        const snapshot = { ...entry };
        entry.subscribers.forEach((subscriber) => subscriber(snapshot));
        entry.subscribers.clear();
    });

    return () => entry.subscribers.delete(callback);
};

const EvidenceFilePreview = ({ src, alt }) => {
    const [shouldLoad, setShouldLoad] = useState(false);
    const [objectUrl, setObjectUrl] = useState('');
    const [previewType, setPreviewType] = useState('');
    const [failed, setFailed] = useState(false);
    const previewRef = useRef(null);

    useEffect(() => {
        setShouldLoad(false);
        setObjectUrl('');
        setPreviewType('');
        setFailed(false);
    }, [src]);

    useEffect(() => {
        if (!src) return undefined;
        if (typeof IntersectionObserver === 'undefined') {
            setShouldLoad(true);
            return undefined;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShouldLoad(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '180px 0px' }
        );

        if (previewRef.current) observer.observe(previewRef.current);
        return () => observer.disconnect();
    }, [src]);

    useEffect(() => {
        if (!src || !shouldLoad) return undefined;

        return subscribeToEvidencePreview(src, (entry) => {
            if (entry.status === 'failed') {
                setFailed(true);
                return;
            }

            if (entry.status === 'ready') {
                setPreviewType(entry.previewType);
                setObjectUrl(entry.objectUrl);
            }
        });
    }, [src, shouldLoad]);

    if (failed) {
        return (
            <div ref={previewRef} className="mt-3 flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-500">
                Preview unavailable
            </div>
        );
    }

    if (!objectUrl) {
        return (
            <div ref={previewRef} className="mt-3 flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-500">
                {shouldLoad ? 'Loading preview...' : 'Preview will load when visible'}
            </div>
        );
    }

    if (previewType === 'image') {
        return (
        <img
            ref={previewRef}
            src={objectUrl}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="mt-3 h-36 w-full rounded-lg border border-slate-200 object-cover"
        />
        );
    }

    if (previewType === 'pdf') {
        return (
            <iframe
                ref={previewRef}
                src={objectUrl}
                title={alt}
                loading="lazy"
                className="mt-3 h-36 w-full rounded-lg border border-slate-200 bg-white"
            />
        );
    }

    return (
        <div ref={previewRef} className="mt-3 flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-500">
            Preview unavailable
        </div>
    );
};

const DetailField = ({ icon: Icon, label, value, helper = null, action = null }) => (
    <div className={FIELD_CARD_CLASS}>
        <div className="flex items-start gap-3">
            {Icon ? (
                <div className="rounded-lg bg-white p-2 text-slate-500 shadow-sm shadow-slate-200/60 ">
                    <Icon size={16} />
                </div>
            ) : null}
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <div className="mt-1.5 text-sm font-semibold text-slate-950 ">{value || 'N/A'}</div>
                {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
            </div>
            {action}
        </div>
    </div>
);

const TimelineStep = ({ step, isLast }) => {
    const Icon = step.icon || Activity;
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${step.surfaceClass}`}>
                    <Icon size={16} className={step.iconClass} />
                </div>
                {!isLast ? <div className="mt-2 h-full min-h-[46px] w-px bg-slate-200 " /> : null}
            </div>
            <div className="flex-1 pb-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-950 ">{step.label}</p>
                        {step.note ? <p className="mt-1 text-sm text-slate-500">{step.note}</p> : null}
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                        {formatShortDateTime(step.time)}
                    </span>
                </div>
            </div>
        </div>
    );
};

const IncidentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();
    const confirm = useConfirm();
    const { markNotificationAsRead, notifications, refreshNotifications } = useNotifications();

    const [incident, setIncident] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [selectedHandler, setSelectedHandler] = useState('');
    const [note, setNote] = useState('');
    const [adminFinalNote, setAdminFinalNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [fieldOptions, setFieldOptions] = useState([]);
    const [newOptionLabel, setNewOptionLabel] = useState('');
    const [generatedLetter, setGeneratedLetter] = useState(null);
    const [progressLoading, setProgressLoading] = useState(false);
    const [evidenceTypes, setEvidenceTypes] = useState([]);
    const [evidenceEntries, setEvidenceEntries] = useState([{ evidenceType: '', file: null, preview: null }]);
    const [evidenceLoading, setEvidenceLoading] = useState(false);
    const [deletingEvidenceId, setDeletingEvidenceId] = useState('');
    const [dragActiveIndex, setDragActiveIndex] = useState(null);
    const [evidenceUploadDone, setEvidenceUploadDone] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [descriptionDraft, setDescriptionDraft] = useState('');
    const [descriptionEditing, setDescriptionEditing] = useState(false);
    const [descriptionSaving, setDescriptionSaving] = useState(false);
    const [letterGenerating, setLetterGenerating] = useState(false);
    const [letterLanguage, setLetterLanguage] = useState('en');
    const [letterPermission, setLetterPermission] = useState({ open: false, templates: null, categoryName: '', loading: false });
    const exportInFlightRef = useRef(false);
    const deleteInFlightRef = useRef(false);
    const markedIncidentReadRef = useRef('');
    const userId = getRecordId(user);
    const detailSectionRefs = useRef({});
    const [activeDetailSection, setActiveDetailSection] = useState('overview');

    const fetchFieldOptions = useCallback(async () => {
        try {
            const [optsRes, evidenceOpts] = await Promise.all([
                apiClient.get('/api/field-operation-options'),
                apiClient.get('/api/evidence-types'),
            ]);
            setFieldOptions(Array.isArray(optsRes.data) ? optsRes.data : []);
            setEvidenceTypes(Array.isArray(evidenceOpts.data) ? evidenceOpts.data : []);
        } catch {
            // Non-fatal
        }
    }, []);

    useEffect(() => { fetchFieldOptions(); }, [fetchFieldOptions]);

    // Mark read in user-scoped localStorage.
    useEffect(() => {
        if (!id || !userId) return;

        migrateIncidentStorageForUser(userId);
        const readIds = readUserList('readIncidents', userId);
        if (!readIds.includes(id)) {
            writeUserList('readIncidents', userId, [...readIds, id]);
        }
        const priorityIds = readUserList('priorityIncidents', userId);
        if (priorityIds.includes(id)) {
            writeUserList('priorityIncidents', userId, priorityIds.filter((pid) => pid !== id));
        }
    }, [id, userId]);

    useEffect(() => {
        if (!id || !userId) return;
        const related = notifications.filter(
            (n) => n?.read !== true && (
                getRecordId(n?.incident || '') === id ||
                n?.routePath === `/incidents/${id}` ||
                n?.entityId === id
            )
        );
        related.forEach((n) => markNotificationAsRead(n));
    }, [id, markNotificationAsRead, notifications, userId]);

    useEffect(() => {
        const markReadKey = `${userId}:${id}`;
        if (!id || !userId || !isValidMongoObjectId(id) || markedIncidentReadRef.current === markReadKey) return;

        markedIncidentReadRef.current = markReadKey;
        apiClient
            .put(`/api/incidents/${id}/read`, {})
            .then(() => refreshNotifications({ silent: true }))
            .catch(() => {
                markedIncidentReadRef.current = '';
            });
    }, [id, refreshNotifications, userId]);

    const handleSelectOption = (option) => {
        const label = option?.label;
        if (!label) return;
        setNote((current) => (current ? `${current}\n- ${label}` : `- ${label}`));
    };

    const handleAddOption = async () => {
        if (!newOptionLabel.trim()) return;
        try {
            await apiClient.post('/api/field-operation-options', { type: 'updated', label: newOptionLabel.trim() });
            setNewOptionLabel('');
            fetchFieldOptions();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to add option.', 'error');
        }
    };

    const handleDeleteOption = async (optionId) => {
        const confirmed = await confirm({
            tone: 'danger',
            title: 'Delete saved option?',
            description: 'Delete this preset option from the field update list? Existing progress notes will not be changed.',
            confirmLabel: 'Delete option',
        });
        if (!confirmed) return;
        try {
            await apiClient.delete(`/api/field-operation-options/${optionId}`);
            fetchFieldOptions();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to delete option.', 'error');
        }
    };

    const fetchIncident = useCallback(async () => {
        if (!id || !userId) return;
        if (!isValidMongoObjectId(id)) {
            setIncident(null);
            setError('Invalid incident link. Please open the incident from the list again.');
            setLoading(false);
            return;
        }
        try {
            setError(null);
            const { data } = await apiClient.get(`/api/incidents/${id}`);
            setIncident(data);
            setDescriptionDraft(data?.description || '');
        } catch (err) {
            const status = err.response?.status;
            setIncident(null);
            setError(
                status === 404
                    ? 'Incident not found. It may have been deleted or moved.'
                    : err.response?.data?.message || 'Failed to load incident.'
            );
        } finally {
            setLoading(false);
        }
    }, [id, userId]);

    const fetchStaff = useCallback(async () => {
        if (!userId) return;
        try {
            const { data } = await apiClient.get('/api/auth/users/investigators');
            setStaffList(Array.isArray(data) ? data : []);
        } catch {
            setStaffList([]);
        }
    }, [userId]);

    const fetchGeneratedLetter = useCallback(async () => {
        if (!id || !userId || !isValidMongoObjectId(id)) return;
        try {
            const { data } = await apiClient.get(`/api/issued-letters/incident/${id}`);
            setGeneratedLetter(Array.isArray(data) && data.length > 0 ? data[0] : null);
        } catch {
            setGeneratedLetter(null);
        }
    }, [id, userId]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchIncident();
        fetchStaff();
        fetchGeneratedLetter();
    }, [fetchGeneratedLetter, fetchIncident, fetchStaff]);

    const handleSubmitProgress = async () => {
        if (!note.trim()) return;
        setProgressLoading(true);
        try {
            // Backend route: PUT /api/incidents/:id/progress
            await apiClient.put(`/api/incidents/${id}/progress`, { note: note.trim() });
            setNote('');
            addToast('Progress saved successfully', 'success');
            await fetchIncident();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to save progress', 'error');
        } finally {
            setProgressLoading(false);
        }
    };

    const handleEvidenceTypeChange = (index, value) => {
        const next = [...evidenceEntries];
        next[index].evidenceType = value;
        setEvidenceEntries(next);
    };

    const handleEvidenceFileChange = (index, file) => {
        if (!file) return;
        const next = [...evidenceEntries];
        next[index].file = file;
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                next[index].preview = reader.result;
                setEvidenceEntries([...next]);
            };
            reader.readAsDataURL(file);
            return;
        }
        next[index].preview = null;
        setEvidenceEntries(next);
    };

    const handleAddEvidenceEntry = () => {
        const defaultType = evidenceTypes.length > 0 ? evidenceTypes[0].name || evidenceTypes[0] : '';
        setEvidenceEntries((prev) => [...prev, { evidenceType: defaultType, file: null, preview: null }]);
    };

    const handleOpenEvidenceForm = () => {
        setEvidenceUploadDone(false);
        setShowUploadForm(true);
        setEvidenceEntries((prev) => {
            if (prev?.some((e) => e?.file || e?.evidenceType)) return prev;
            const defaultType = evidenceTypes.length > 0 ? evidenceTypes[0].name || evidenceTypes[0] : '';
            return [{ evidenceType: defaultType, file: null, preview: null }];
        });
    };

    const handleCancelEvidenceForm = () => {
        if (evidenceLoading) return;
        const defaultType = evidenceTypes.length > 0 ? evidenceTypes[0].name || evidenceTypes[0] : '';
        setEvidenceEntries([{ evidenceType: defaultType, file: null, preview: null }]);
        setDragActiveIndex(null);
        setEvidenceUploadDone(false);
        setShowUploadForm(false);
    };

    const handleRemoveEvidenceEntry = (index) =>
        setEvidenceEntries((prev) => prev.filter((_, i) => i !== index));

    const handleRemoveEvidenceFile = (index) =>
        setEvidenceEntries((prev) =>
            prev.map((e, i) => i === index ? { ...e, file: null, preview: null } : e)
        );

    const handleOpenEvidenceFile = async (fileUrl, filename) => {
        if (!fileUrl) { addToast('File not found', 'error'); return; }
        if (isNativeDownloadPlatform()) {
            try {
                await withFeedback(
                    addToast,
                    () => openRemoteFile(
                        withEvidenceDisposition(fileUrl, 'inline'),
                        filename || fileUrl.split('/').pop() || 'evidence-file',
                        {
                            errorMessage: 'File not found',
                        }
                    ),
                    {
                        successMessage: 'File opened successfully.',
                        errorMessage: 'Could not open file.',
                    }
                );
            } catch {
            }
            return;
        }
        window.open(withEvidenceDisposition(fileUrl, 'inline'), '_blank', 'noopener,noreferrer');
        addToast('File opened successfully.', 'success');
    };

    const handleDownloadEvidenceFile = async (fileUrl, filename) => {
        if (!fileUrl) { addToast('File not found', 'error'); return; }
        try {
            await withFeedback(
                addToast,
                () => downloadRemoteFile(
                    withEvidenceDisposition(fileUrl, 'attachment'),
                    filename || 'evidence-file',
                    {
                        title: 'Evidence file',
                        errorMessage: 'File not found',
                    }
                ),
                {
                    successMessage: 'Evidence downloaded successfully.',
                    errorMessage: 'Download failed.',
                }
            );
        } catch {
        }
    };

    const submitEvidence = async () => {
        const valid = evidenceEntries.filter((e) => e.file);
        if (valid.length === 0) { addToast('Please select at least one file to upload.', 'error'); return; }
        setEvidenceLoading(true);
        setEvidenceUploadDone(false);
        try {
            const formData = new FormData();
            formData.append('evidenceDetails', JSON.stringify(valid.map((e) => ({ evidenceType: e.evidenceType }))));
            valid.forEach((e) => formData.append('evidence', e.file));
            // Backend route: PUT /api/incidents/:id/add-evidence
            await apiClient.put(`/api/incidents/${id}/add-evidence`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            addToast('Evidence uploaded successfully', 'success');
            setEvidenceUploadDone(true);
            const defaultType = evidenceTypes.length > 0 ? evidenceTypes[0].name || evidenceTypes[0] : '';
            setEvidenceEntries([{ evidenceType: defaultType, file: null, preview: null }]);
            await fetchIncident();
            setShowUploadForm(false);
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to upload evidence.', 'error');
        } finally {
            setEvidenceLoading(false);
        }
    };

    const handleDeleteEvidence = async (entry) => {
        const evidenceId = getRecordId(entry);
        if (!evidenceId) { addToast('Evidence record not found.', 'error'); return; }
        const confirmed = await confirm({
            tone: 'danger',
            title: 'Delete evidence file?',
            description: `Delete this ${entry?.evidenceType || 'evidence'} record? This removes the evidence record and the stored file from this incident.`,
            confirmLabel: 'Delete evidence',
        });
        if (!confirmed) return;
        setDeletingEvidenceId(evidenceId);
        try {
            await apiClient.delete(`/api/incidents/${id}/evidence/${evidenceId}`);
            setIncident((current) => current ? {
                ...current,
                evidence: (current.evidence || []).filter((item) => getRecordId(item) !== evidenceId),
            } : current);
            addToast('Evidence deleted successfully.', 'success');
            await fetchIncident();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to delete evidence.', 'error');
        } finally {
            setDeletingEvidenceId('');
        }
    };

    const handleSaveDescription = async () => {
        setDescriptionSaving(true);
        try {
            await apiClient.put(`/api/incidents/${id}/description`, { description: descriptionDraft });
            addToast('Description updated successfully.', 'success');
            setDescriptionEditing(false);
            await fetchIncident();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to update description.', 'error');
        } finally {
            setDescriptionSaving(false);
        }
    };

    const checkLetterTemplate = useCallback(async () => {
        const categoryName = incident?.incidentCategory || incident?.category;
        if (!categoryName) {
            return { en: null, ta: null, message: 'No category is available for this incident.' };
        }

        try {
            const response = await apiClient.get(`/api/letter-templates/category/${encodeURIComponent(categoryName)}`);
            const template = response.data;
            if (!template) {
                return { en: null, ta: null, message: 'No official letter file is set up for this category yet.' };
            }
            return {
                en: template.hasEnglishDocx ? template : null,
                ta: template.hasTamilDocx ? template : null,
                message: template.message || 'Official letter file ready',
            };
        } catch (err) {
            if (err.response?.status === 404) {
                return { en: null, ta: null, message: 'No official letter file is set up for this category yet.' };
            }
            return { en: null, ta: null, error: 'Could not check letter templates right now.' };
        }
    }, [incident?.category, incident?.incidentCategory]);

    const handleOpenLetterPermission = async () => {
        if (letterPermission.loading) return;
        setLetterPermission({ open: false, templates: null, categoryName: incident?.category || '', loading: true });
        const templates = await checkLetterTemplate();
        const hasTemplate = Boolean(templates?.en || templates?.ta);
        if (!hasTemplate) {
            setLetterPermission({ open: false, templates: null, categoryName: incident?.category || '', loading: false });
            addToast(templates?.error || templates?.message || 'No matching letter template is available.', templates?.error ? 'error' : 'warning');
            return;
        }
        setLetterLanguage(templates.en ? 'en' : 'ta');
        setLetterPermission({
            open: true,
            templates,
            categoryName: incident?.category || '',
            loading: false,
        });
    };

    const handleGenerateLetter = async () => {
        if (letterGenerating) return;
        setLetterGenerating(true);
        try {
            const { data } = await apiClient.post('/api/issued-letters', { incidentId: id, language: letterLanguage });
            addToast(data?.message || 'Letter generated successfully.', 'success');
            setLetterPermission({ open: false, templates: null, categoryName: '', loading: false });
            await fetchGeneratedLetter();
        } catch (err) {
            addToast(err.response?.data?.message || 'Letter generation failed.', 'error');
        } finally {
            setLetterGenerating(false);
        }
    };

    const handleDelete = useCallback(async () => {
        if (deleteInFlightRef.current) return;
        const confirmed = await confirm({
            tone: 'danger',
            title: 'Permanently delete incident?',
            description: 'This will delete the incident record and related incident files. This action cannot be undone.',
            confirmLabel: 'Delete incident',
        });
        if (!confirmed) return;
        deleteInFlightRef.current = true;
        setIsDeleting(true);
        try {
            await apiClient.delete(`/api/incidents/${id}`);
            navigate('/incidents');
        } catch (err) {
            addToast(err.response?.data?.message || err.message || 'Unable to delete incident.', 'error');
        } finally {
            deleteInFlightRef.current = false;
            setIsDeleting(false);
        }
    }, [addToast, confirm, id, navigate]);

    const handleExportReport = useCallback(async () => {
        if (exportInFlightRef.current) return;
        exportInFlightRef.current = true;
        setIsExporting(true);
        try {
            const response = await apiClient.get(`/api/incidents/${id}/export-report`, { responseType: 'blob' });
            let filename = parseDownloadFilename(response.headers['content-disposition'], `incident_report_${id}.docx`);
            if (!filename.endsWith('.docx')) filename = `${filename.replace(/\.[^/.]+$/, '')}.docx`;
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            await withFeedback(
                addToast,
                () => downloadBlob(blob, filename, {
                    title: 'Incident case report',
                }),
                {
                    successMessage: 'Report downloaded successfully.',
                    errorMessage: 'Report download failed.',
                }
            );
        } catch {
        } finally {
            exportInFlightRef.current = false;
            setIsExporting(false);
        }
    }, [addToast, id]);

    // All workflow transitions use PUT — matching backend route definitions
    const handleAction = useCallback(async (path, payload = {}) => {
        if (path === 'request-closure' && !String(payload.actionTaken || '').trim()) {
            addToast('Action taken is required before requesting case closure.', 'error');
            return;
        }
        const messages = {
            assign: 'Assign this case?',
            progress: 'Add this progress note?',
            'request-closure': 'Close this case?',
            'finalize-closure': 'Finalize and close this case?',
            'reject-closure': 'Reject closure and return to handler?',
        };
        const confirmed = await confirm({
            tone: path === 'reject-closure' ? 'warning' : 'info',
            title: 'Confirm case action',
            description: messages[path] || `Proceed with ${path}?`,
            confirmLabel: path === 'progress' ? 'Save update' : 'Confirm action',
        });
        if (!confirmed) return;
        try {
            setActionLoading(true);
            const { data } = await apiClient.put(`/api/incidents/${id}/${path}`, payload);
            setAdminFinalNote('');
            setNote('');
            await fetchIncident();
            if (path === 'assign') {
                addToast(data?.message || 'Incident assigned.', data?.alreadyAssigned ? 'info' : 'success');
            }
        } catch (err) {
            addToast(err.response?.data?.message || 'Action failed. Please try again.', 'error');
        } finally {
            setActionLoading(false);
        }
    }, [addToast, confirm, fetchIncident, id]);

    const handleAssignToMyself = useCallback(() => {
        if (!userId) {
            addToast('Could not detect the current user. Please sign in again.', 'error');
            return;
        }
        if (getRecordId(incident?.assignedHandler) === userId) {
            addToast('Already assigned to you.', 'info');
            return;
        }
        handleAction('assign', { handlerId: userId });
    }, [addToast, handleAction, incident?.assignedHandler, userId]);

    const handleGeneratedLetterDownload = useCallback(async () => {
        const letterId = getRecordId(generatedLetter) || getRecordId(incident?.letterGenerated);
        if (!letterId || !userId) return;
        try {
            const response = await apiClient.get(`/api/issued-letters/${letterId}/download`, { responseType: 'blob' });
            const studentName = slugify(incident?.studentsInvolved?.[0] || 'Student');
            const className = slugify(incident?.class || 'Class');
            const section = slugify(incident?.section || 'S');
            const admissionNo = slugify(incident?.admissionNo || '00000');
            const filename = `LET_${className}_${section}_${studentName}_${admissionNo}.docx`;
            await withFeedback(
                addToast,
                () => downloadBlob(
                    new Blob([response.data], {
                        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    }),
                    filename,
                    { title: 'Generated letter' }
                ),
                {
                    successMessage: 'Letter downloaded successfully.',
                    errorMessage: 'Download failed.',
                }
            );
        } catch {
        }
    }, [addToast, generatedLetter, incident, userId]);

    const isHandler = useMemo(() => {
        if (!incident || !user) return false;
        if (isAdminRole(user.role) || isTeacherRole(user.role)) return true;
        return false;
    }, [incident, user]);

    const timelineData = useMemo(() => {
        if (!incident) return [];
        const status = incident.status || 'Pending';
        const steps = [];
        const openedTime = getIncidentTimestamp(incident);
        if (openedTime) {
            steps.push({
                label: 'Incident Registered', time: openedTime,
                note: 'Manual timeline date is used as the primary opened timestamp for this case.',
                icon: Activity, surfaceClass: 'bg-blue-50', iconClass: 'text-blue-600',
            });
        }
        const progressTime = incident.inProgressAt || incident.progressAt;
        if (progressTime) {
            steps.push({
                label: 'Active Investigation', time: progressTime,
                note: 'The case moved into active handling.',
                icon: Clock, surfaceClass: 'bg-blue-50', iconClass: 'text-blue-600',
            });
        }
        if (incident.closedAt && status === 'Closed') {
            steps.push({
                label: 'Case Closed', time: incident.closedAt,
                note: incident.actionTaken || 'The case was finalized and closed.',
                icon: CheckCircle, surfaceClass: 'bg-emerald-50', iconClass: 'text-emerald-600',
            });
        }
        return steps;
    }, [incident]);

    const studentNames = useMemo(() => {
        if (incident?.studentDetails?.name) return incident.studentDetails.name;
        if (!incident?.studentsInvolved) return 'N/A';
        return Array.isArray(incident.studentsInvolved) ? incident.studentsInvolved.join(', ') : String(incident.studentsInvolved);
    }, [incident]);

    const evidenceAssets = useMemo(() => Array.isArray(incident?.evidence) ? incident.evidence : [], [incident?.evidence]);
    const progressLogs = useMemo(
        () => (Array.isArray(incident?.progressLogs) ? [...incident.progressLogs].reverse() : []),
        [incident?.progressLogs]
    );

    const statusStyle = getStatusStyle(incident?.status);

    const showRejectionAlert = Boolean(incident?.rejectionReason && !incident?.closureRequested && incident?.status !== 'Closed');
    const showClosureRequestedAlert = Boolean(incident?.closureRequested && incident?.status !== 'Closed');
    const isAdminUser = isAdminRole(user?.role);
    const canManageIncident = isAdminUser || isTeacherRole(user?.role);
    const showCaseAllocation = Boolean(canManageIncident && incident?.status !== 'Closed');
    const showAdminCommand = Boolean(isAdminUser && incident?.status !== 'Closed');
    const showFieldUpdates = Boolean(
        isHandler &&
        incident?.status !== 'Closed'
    );
    const detailTabs = useMemo(() => ([
        { key: 'overview', label: 'Overview', count: 0, icon: ShieldCheck },
        { key: 'evidence', label: 'Evidence', count: evidenceAssets.length, icon: FileImage },
        { key: 'progress', label: 'Progress', count: progressLogs.length, icon: Activity },
        { key: 'letters', label: 'Letters', count: incident?.letterGenerated || generatedLetter ? 1 : 0, icon: Mail },
        { key: 'notes', label: 'Notes', count: progressLogs.length, icon: MessageSquare },
        { key: 'actionLog', label: 'Action Log', count: timelineData.length, icon: Clock },
    ]), [evidenceAssets.length, generatedLetter, incident?.letterGenerated, progressLogs.length, timelineData.length]);
    const scrollToDetailSection = useCallback((sectionKey) => {
        setActiveDetailSection(sectionKey);
        detailSectionRefs.current[sectionKey]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    }, []);

    if (loading && !incident) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                    <p className="font-medium text-slate-500">Loading case workspace...</p>
                </div>
            </div>
        );
    }

    if (error || !incident) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
                <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                    <p className="mb-5 font-medium text-red-600">{error || 'Incident not found.'}</p>
                    <button type="button" onClick={() => navigate('/incidents')}
                        aria-label="Back to incident list"
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        Back to List
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="incident-workspace w-full min-w-0 bg-[#f6f8fc] p-3 text-slate-800 sm:p-4 lg:p-6">
            <div className="mx-auto max-w-[1680px] space-y-4">
                        <section className="incident-hero space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500" aria-label="Breadcrumb">
                                        <button type="button" onClick={() => navigate('/incidents')} className="inline-flex items-center gap-1 text-blue-600 transition hover:text-blue-700">
                                            <Activity size={14} /> All Incidents
                                        </button>
                                        <span aria-hidden="true">/</span>
                                        <span className="text-slate-800 ">Incident Details</span>
                                    </nav>
                                    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-bold uppercase ${statusStyle.badge}`}>
                                        {formatDisplayValue(incident.status || 'Pending')}
                                    </span>
                                    <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-[28px]">
                                        {incident.title || 'Untitled Incident'}
                                    </h1>
                                    <p className="mt-2 text-sm font-medium text-slate-600 ">
                                        Admission No: {incident.admissionNo || 'N/A'} <span className="mx-2">-</span> Incident ID: {incident.incidentId || id}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => navigate('/incidents')}
                                        aria-label="Back to incident list"
                                        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ">
                                        <ArrowLeft size={16} />Back to List
                                    </button>
                                    {incident.status !== 'Closed' && canManageIncident ? (
                                        <button type="button" onClick={() => {
                                            setDescriptionDraft(incident.description || '');
                                            setDescriptionEditing(true);
                                        }}
                                            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                            <FileText size={16} />Edit Description
                                        </button>
                                    ) : null}
                                    <button type="button" onClick={handleExportReport} disabled={isExporting}
                                        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60">
                                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                        Export
                                    </button>
                                    {isAdminUser ? (
                                        <button type="button" onClick={handleDelete} disabled={isDeleting}
                                            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60">
                                            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            Delete Incident
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </section>

                        {showRejectionAlert ? (
                            <div role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-2xl bg-white p-2.5 text-red-600 shadow-sm"><ShieldAlert size={18} /></div>
                                    <div>
                                        <p className="font-semibold text-red-800">Re-investigation required</p>
                                        <p className="mt-1 text-sm text-red-700">{incident.rejectionReason}</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {showClosureRequestedAlert ? (
                            <div role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-2xl bg-white p-2.5 text-amber-600 shadow-sm"><Zap size={18} /></div>
                                    <div>
                                        <p className="font-semibold text-amber-800">Closure request pending</p>
                                        <p className="mt-1 text-sm text-amber-700">
                                            The assigned handler has requested final closure. Admin review is still required.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="incident-summary-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <DetailField icon={Calendar} label="Incident Date" value={formatShortDateTime(getIncidentTimestamp(incident))} />
                            <DetailField icon={FileText} label="Category" value={formatDisplayValue(incident.category || 'N/A')} />
                            <DetailField icon={Users} label="Reported By" value={resolveUserLabel(incident.reportedBy)} />
                            <DetailField icon={UserCheck} label="Assigned To" value={resolveHandlerLabel(incident)} />
                            <DetailField icon={Calendar} label="Opened On" value={formatShortDateTime(getIncidentTimestamp(incident))} />
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ">
                            <div className="flex overflow-x-auto" role="tablist" aria-label="Incident detail sections">
                                {detailTabs.map(({ key, label, count, icon: Icon }) => (
                                    <button
                                        key={label}
                                        type="button"
                                        role="tab"
                                        onClick={() => scrollToDetailSection(key)}
                                        aria-selected={activeDetailSection === key}
                                        className={`inline-flex min-w-max items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition ${
                                            activeDetailSection === key
                                                ? 'border-blue-600 bg-blue-50/70 text-blue-700'
                                                : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800 '
                                        }`}
                                    >
                                        <Icon size={15} />
                                        {label}
                                        {count ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{count}</span> : null}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div ref={(node) => { detailSectionRefs.current.overview = node; }} className="scroll-mt-24 grid grid-cols-1 gap-4 2xl:grid-cols-12">
                            <DashboardPanel className="2xl:col-span-8" title="Incident Description" description="" icon={FileText}>
                                <div className="flex items-start gap-3">
                                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><FileText size={16} /></div>
                                    <div className="min-w-0 flex-1">
                                        {descriptionEditing ? (
                                            <div className="space-y-3">
                                                <textarea
                                                    className="min-h-[112px] w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    value={descriptionDraft}
                                                    maxLength={3000}
                                                    onChange={(event) => setDescriptionDraft(event.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleSaveDescription}
                                                    disabled={descriptionSaving}
                                                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                                                >
                                                    {descriptionSaving ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Check size={16} className="mr-2 inline" />}
                                                    Save Description
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 ">
                                                {incident.description || 'No description provided.'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </DashboardPanel>

                            <DashboardPanel className="2xl:col-span-4" title="Current Status" description="" icon={incident.status === 'Closed' ? CheckCircle : Clock}>
                                <div className="flex items-start gap-4">
                                    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${incident.status === 'Closed' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {incident.status === 'Closed' ? <CheckCircle size={22} /> : <Clock size={22} />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-extrabold text-slate-950 ">{formatDisplayValue(incident.status || 'Pending')}</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {incident.status === 'Closed' ? 'This incident has been resolved and closed.' : 'This incident is currently active.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-5 space-y-4 text-sm">
                                    <DetailField icon={Calendar} label={incident.status === 'Closed' ? 'Closed On' : 'Opened On'} value={formatShortDateTime(incident.closedAt || getIncidentTimestamp(incident))} />
                                    <DetailField icon={UserCheck} label={incident.status === 'Closed' ? 'Closed By' : 'Assigned To'} value={incident.status === 'Closed' ? resolveUserLabel(incident.closedBy, resolveHandlerLabel(incident)) : resolveHandlerLabel(incident)} />
                                    {incident.actionTaken ? (
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                            <p className="font-semibold">Resolution</p>
                                            <p className="mt-1">{incident.actionTaken}</p>
                                        </div>
                                    ) : null}
                                </div>
                            </DashboardPanel>
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                            <DashboardPanel className="xl:col-span-7" title="Student Information" description="" icon={Users}>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <DetailField icon={Users} label="Student Name" value={studentNames}
                                        action={incident.admissionNo ? (
                                            <button type="button" onClick={() => navigate(`/student-analytics/${incident.admissionNo}`)}
                                                className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
                                                <ExternalLink size={14} />View Student
                                            </button>
                                        ) : null}
                                    />
                                    <DetailField icon={FileText} label="Admission Number" value={incident.admissionNo || 'N/A'} />
                                    <DetailField icon={Calendar} label="Class and Section"
                                        value={incident.class && incident.section ? `${incident.class} / ${incident.section}` : 'N/A'} />
                                    <DetailField icon={Calendar} label="Academic Year" value={incident.academicYear || 'N/A'} />
                                </div>
                            </DashboardPanel>

                            <DashboardPanel className="xl:col-span-5" title="Incident Information" description="" icon={MessageSquare}>
                                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                                    <DetailField icon={FileText} label="Category" value={formatDisplayValue(incident.category || 'N/A')} />
                                    <DetailField icon={MapPin} label="Location" value={formatDisplayValue(incident.location || 'N/A')} />
                                    <DetailField icon={Calendar} label="Incident Date" value={formatShortDate(getIncidentTimestamp(incident))} helper="Date the incident occurred." />
                                    <div className={`${FIELD_CARD_CLASS} hidden`}>
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-2xl bg-white p-2.5 text-slate-600 shadow-sm shadow-slate-200/70"><MessageSquare size={18} /></div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Description</p>
                                                    {incident.status !== 'Closed' && canManageIncident ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setDescriptionDraft(incident.description || '');
                                                                setDescriptionEditing((value) => !value);
                                                            }}
                                                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                                        >
                                                            {descriptionEditing ? 'Cancel' : 'Edit'}
                                                        </button>
                                                    ) : null}
                                                </div>
                                                {descriptionEditing ? (
                                                    <div className="mt-3 space-y-3">
                                                        <textarea
                                                            className="min-h-[130px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                            value={descriptionDraft}
                                                            maxLength={3000}
                                                            onChange={(event) => setDescriptionDraft(event.target.value)}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveDescription}
                                                            disabled={descriptionSaving}
                                                            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                                                        >
                                                            {descriptionSaving ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Check size={16} className="mr-2 inline" />}
                                                            Save Description
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                                        {incident.description || 'No description provided.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </DashboardPanel>

                            <DashboardPanel className="xl:col-span-12" title="Case Administration" description="" icon={ShieldCheck}>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <DetailField icon={ShieldCheck} label="Reported By" value={resolveUserLabel(incident.reportedBy)} />
                                    <DetailField icon={UserCheck} label="Handled By"
                                        value={resolveHandlerLabel(incident)}
                                    />
                                    <DetailField icon={Calendar} label="Opened" value={formatShortDateTime(getIncidentTimestamp(incident))} />
                                    <DetailField icon={Activity} label="Last Updated" value={formatShortDateTime(incident.updatedAt || incident.closedAt || getIncidentTimestamp(incident))} />
                                </div>
                            </DashboardPanel>
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
                            <div className="space-y-4 xl:col-span-8">
                                <div ref={(node) => { detailSectionRefs.current.actionLog = node; }} className="scroll-mt-24">
                                <DashboardPanel title="Case History" description="Important milestones as this case moves from opened through closed." icon={Clock} bodyClassName="max-h-[360px] overflow-y-auto custom-scrollbar">
                                    {timelineData.length === 0 ? (
                                        <EmptyStatePanel title="No case history yet" description="Milestones will appear here as the case progresses through each stage." />
                                    ) : (
                                        <div className="space-y-4">
                                            {timelineData.map((step, index) => (
                                                <TimelineStep key={`${step.label}-${index}`} step={step} isLast={index === timelineData.length - 1} />
                                            ))}
                                        </div>
                                    )}
                                </DashboardPanel>
                                </div>

                                <div ref={(node) => { detailSectionRefs.current.evidence = node; }} className="scroll-mt-24">
                                <DashboardPanel
                                    title="Evidence Records"
                                    description="Uploaded files and supporting documents attached to this case."
                                    icon={FileImage}
                                    actions={incident.status !== 'Closed' && canManageIncident ? (
                                        <button type="button" onClick={handleOpenEvidenceForm}
                                            aria-label="Add evidence to this case"
                                            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                                            <Plus size={16} className="mr-2 inline" />Add Evidence
                                        </button>
                                    ) : null}
                                >
                                    {evidenceAssets.length === 0 ? (
                                        <EmptyStatePanel title="No evidence on record" description="Upload supporting files — photos, documents, or reports — to support this case." />
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            {evidenceAssets.map((entry, index) => {
                                                const fileUrl = resolveFileUrl(entry?.fileUrl);
                                                const previewUrl = withEvidenceDisposition(fileUrl, 'inline');
                                                const fileLabel = getEvidenceFilename(entry, `${entry?.evidenceType || 'Evidence'} file ${index + 1}`);
                                                return (
                                                    <div key={`${entry?.fileUrl || entry?.evidenceType || 'ev'}-${index}`}
                                                        className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-200/40">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{entry?.evidenceType || 'Evidence'}</p>
                                                            </div>
                                                        </div>
                                                        {previewUrl ? (
                                                            <EvidenceFilePreview
                                                                src={previewUrl}
                                                                alt={entry?.evidenceType || `Evidence ${index + 1}`}
                                                            />
                                                        ) : (
                                                            <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-500" aria-label="File preview not available">
                                                                Preview not available
                                                            </div>
                                                        )}
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            {fileUrl ? (
                                                                <>
                                                                    <button type="button" onClick={() => handleOpenEvidenceFile(fileUrl, fileLabel)}
                                                                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                                                                        <ExternalLink size={15} className="mr-2" />Open
                                                                    </button>
                                                                    <button type="button" onClick={() => handleDownloadEvidenceFile(fileUrl, fileLabel)}
                                                                        className="inline-flex items-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                                                                        <Download size={15} className="mr-2" />Download
                                                                    </button>
                                                                </>
                                                            ) : null}
                                                            {incident.status !== 'Closed' && canManageIncident ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteEvidence(entry)}
                                                                    disabled={deletingEvidenceId === getRecordId(entry)}
                                                                    className="inline-flex items-center rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                                                                >
                                                                    {deletingEvidenceId === getRecordId(entry) ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Trash2 size={15} className="mr-2" />}
                                                                    Delete
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {showUploadForm ? (
                                        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">Upload evidence</p>
                                                    <p className="mt-1 text-sm text-slate-500">Attach one or more files and choose a category for each before saving.</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <button type="button" onClick={handleAddEvidenceEntry}
                                                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">
                                                        <PlusCircle size={16} className="mr-2 inline" />Add File
                                                    </button>
                                                    <button type="button" onClick={handleCancelEvidenceForm} disabled={evidenceLoading}
                                                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-5 space-y-4">
                                                {evidenceEntries.map((entry, index) => (
                                                    <div key={`ev-entry-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Evidence File</p>
                                                            {evidenceEntries.length > 1 ? (
                                                                <button type="button" onClick={() => handleRemoveEvidenceEntry(index)} className="text-slate-400 transition hover:text-red-600">
                                                                    <X size={16} />
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                        <div className="mt-4 grid gap-4">
                                                            <div>
                                                                <label htmlFor={`evidence-category-${index}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Evidence Category</label>
                                                                <div className="relative">
                                                                    <select
                                                                        id={`evidence-category-${index}`}
                                                                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                                        value={entry.evidenceType}
                                                                        onChange={(e) => handleEvidenceTypeChange(index, e.target.value)}
                                                                    >
                                                                        <option value="" disabled>Select evidence type...</option>
                                                                        {evidenceTypes.map((type) => {
                                                                            const label = type?.name || type;
                                                                            return <option key={getRecordId(type) || label} value={label}>{label}</option>;
                                                                        })}
                                                                    </select>
                                                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                                </div>
                                                            </div>
                                                            <label
                                                                htmlFor={`evidence-file-${index}`}
                                                                className={`cursor-pointer rounded-2xl border-2 border-dashed bg-white px-4 py-8 text-center transition ${
                                                                    dragActiveIndex === index ? 'border-indigo-400 bg-indigo-50/40' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20'
                                                                }`}
                                                                onDragOver={(e) => { e.preventDefault(); setDragActiveIndex(index); }}
                                                                onDragLeave={(e) => { e.preventDefault(); setDragActiveIndex(null); }}
                                                                onDrop={(e) => {
                                                                    e.preventDefault(); setDragActiveIndex(null);
                                                                    const f = e.dataTransfer.files?.[0];
                                                                    if (f) handleEvidenceFileChange(index, f);
                                                                }}
                                                            >
                                                                <div className="flex flex-col items-center gap-2 text-slate-500">
                                                                    <UploadCloud size={22} />
                                                                    <span className="text-sm font-medium">{entry.file ? 'File selected. Click to replace.' : 'Click or drag a file to upload'}</span>
                                                                    <span className="text-xs text-slate-400">Supports image, PDF, DOC, DOCX, XLS, and XLSX</span>
                                                                </div>
                                                                <input id={`evidence-file-${index}`} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden"
                                                                    aria-label="Evidence file"
                                                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEvidenceFileChange(index, f); e.target.value = ''; }} />
                                                            </label>
                                                            {entry.file ? (
                                                                <div className="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3">
                                                                    <div className="flex min-w-0 items-center gap-2">
                                                                        <FilePlus size={16} className="shrink-0 text-indigo-600" />
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-sm font-medium text-slate-800">{entry.file.name}</p>
                                                                            <p className="text-xs text-slate-500">{formatFileSize(entry.file.size)}</p>
                                                                        </div>
                                                                    </div>
                                                                    {evidenceUploadDone ? (
                                                                        <Check size={16} className="shrink-0 text-emerald-600" />
                                                                    ) : (
                                                                        <button type="button" onClick={() => handleRemoveEvidenceFile(index)}
                                                                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition hover:bg-red-50">
                                                                            <X size={15} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                            {entry.preview ? (
                                                                <img src={entry.preview} alt="" className="h-32 w-full rounded-2xl border border-slate-200 object-cover" />
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-5 space-y-3">
                                                <button type="button" onClick={submitEvidence}
                                                    disabled={evidenceLoading || !evidenceEntries.some((e) => e.file)}
                                                    className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                    {evidenceLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <UploadCloud size={16} className="mr-2 inline" />}
                                                    {evidenceLoading ? 'Uploading...' : 'Save Evidence to Incident'}
                                                </button>
                                                {evidenceLoading ? <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-2/3 animate-pulse bg-indigo-500" /></div> : null}
                                            </div>
                                        </div>
                                    ) : null}
                                </DashboardPanel>
                                </div>

                                <div ref={(node) => { detailSectionRefs.current.progress = node; detailSectionRefs.current.notes = node; }} className="scroll-mt-24">
                                <DashboardPanel title="Case Updates" description="Notes from staff, follow-up steps, and decisions along the way." icon={Activity} bodyClassName="max-h-[420px] overflow-y-auto custom-scrollbar">
                                    {progressLogs.length === 0 ? (
                                        <EmptyStatePanel title="No case updates yet" description="Use Field Operations to start documenting progress and actions." />
                                    ) : (
                                        <div className="space-y-4">
                                            {progressLogs.map((log, index) => (
                                                <div key={`${log.timestamp || index}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-200/40">
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="flex items-start gap-3">
                                                            <div className="rounded-2xl bg-white p-2.5 text-blue-600 shadow-sm shadow-slate-200/70"><Activity size={18} /></div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-900">{log.updatedBy || 'System Update'}</p>
                                                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{log.note || 'No note recorded.'}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{formatShortDateTime(log.timestamp)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </DashboardPanel>
                                </div>
                            </div>

                            <div className="incident-command-rail space-y-4 xl:col-span-4 xl:sticky xl:top-24">
                                {canManageIncident ? (
                                    <div ref={(node) => { detailSectionRefs.current.letters = node; }} className="scroll-mt-24">
                                    <DashboardPanel title="Generated Letter" description="Official letter linked to this case." icon={FileText}>
                                        {incident.letterGenerated || generatedLetter ? (
                                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                                                <p className="text-sm font-semibold text-emerald-800">
                                                    {generatedLetter?.letterNumber || incident.letterGenerated?.letterNumber || 'Letter Generated'}
                                                </p>
                                                <p className="mt-1 text-sm text-emerald-700">
                                                    Letter layout: {generatedLetter?.templateName || incident.letterGenerated?.templateName || 'School standard'}
                                                </p>
                                                {isAdminUser ? (
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        <button type="button" onClick={handleGeneratedLetterDownload}
                                                            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                                                            <Download size={16} className="mr-2 inline" />Download Word file
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                                                <p className="text-sm font-semibold text-slate-900">No letter generated yet</p>
                                                <p className="mt-1 text-sm text-slate-500">Generate from the matching template when one is available.</p>
                                                <button
                                                    type="button"
                                                    onClick={handleOpenLetterPermission}
                                                    disabled={letterGenerating || letterPermission.loading}
                                                    className="mt-4 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                                >
                                                    {letterGenerating || letterPermission.loading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <FileText size={16} className="mr-2 inline" />}
                                                    Generate Letter
                                                </button>
                                            </div>
                                        )}
                                    </DashboardPanel>
                                    </div>
                                ) : null}

                                {showCaseAllocation ? (
                                    <DashboardPanel title="Handled By" description="Staff Who Dealt With The Incident." icon={UserPlus}>
                                        <div className="space-y-4">
                                            <div>
                                                <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    value={selectedHandler} onChange={(e) => setSelectedHandler(e.target.value)}>
                                                    <option value="">Choose Handler</option>
                                                    {staffList.map((staff) => (
                                                        <option key={getRecordId(staff)} value={getRecordId(staff)}>{resolveUserLabel(staff)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button type="button" onClick={() => handleAction('assign', { handlerId: selectedHandler })}
                                                disabled={!selectedHandler || actionLoading}
                                                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                {actionLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : null}
                                                Assign Selected Handler
                                            </button>
                                            <button type="button" onClick={handleAssignToMyself}
                                                disabled={!userId || actionLoading}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                                                Assign to Myself
                                            </button>
                                        </div>
                                    </DashboardPanel>
                                ) : null}

                                {showAdminCommand ? (
                                    <DashboardPanel title="Close Incident" description="Finalize the case or return it to the handler with a decision note." icon={Lock}>
                                        <div className="space-y-4">
                                            <textarea
                                                className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                placeholder="Decision or closure note (optional)"
                                                value={adminFinalNote}
                                                onChange={(e) => setAdminFinalNote(e.target.value)}
                                            />
                                            <button type="button" onClick={() => handleAction('finalize-closure', { note: adminFinalNote })}
                                                disabled={actionLoading}
                                                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                {actionLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : null}
                                                Finalize and Close Case
                                            </button>
                                            {incident.closureRequested ? (
                                                <button type="button" onClick={() => handleAction('reject-closure', { reason: adminFinalNote })}
                                                    disabled={actionLoading}
                                                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                    Return to Handler
                                                </button>
                                            ) : null}
                                        </div>
                                    </DashboardPanel>
                                ) : null}

                                {showFieldUpdates ? (
                                    <DashboardPanel title="Field Operations" description="Select preset updates or add custom notes to advance the case." icon={UserCheck}
                                        actions={(
                                            <button type="button" onClick={() => setEditMode((v) => !v)}
                                                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${editMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                                                {editMode ? 'Done' : 'Edit Presets'}
                                            </button>
                                        )}
                                    >
                                        <div className="space-y-4">
                                            <div>
                                                <span className="inline-block text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                                                    Updated Notes
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                {(fieldOptions || []).map((option) => (
                                                    <div key={getRecordId(option)}
                                                        className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${editMode ? 'border-slate-200 bg-slate-50' : 'cursor-pointer border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/60'}`}
                                                        onClick={() => { if (!editMode) handleSelectOption(option); }}>
                                                        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${editMode ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                                                            {editMode ? (
                                                                <Trash2 size={14} className="cursor-pointer transition hover:text-red-600"
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteOption(getRecordId(option)); }} />
                                                            ) : <CheckCircle size={16} />}
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700">{option.label}</span>
                                                    </div>
                                                ))}
                                                {(fieldOptions || []).length === 0 ? (
                                                    <EmptyStatePanel title="No preset updates yet" description="Add preset options to speed up workflows." />
                                                ) : null}
                                            </div>
                                            {editMode ? (
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <input type="text" value={newOptionLabel} onChange={(e) => setNewOptionLabel(e.target.value)}
                                                        placeholder="Add new preset..."
                                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddOption(); }} />
                                                    <button type="button" onClick={handleAddOption} disabled={!newOptionLabel.trim()}
                                                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                        <Plus size={16} className="mr-2 inline" />Add
                                                    </button>
                                                </div>
                                            ) : null}
                                            <div>
                                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Custom Note</label>
                                                <textarea
                                                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    placeholder="Add additional notes or details..."
                                                    value={note}
                                                    onChange={(e) => setNote(e.target.value)}
                                                    disabled={incident.closureRequested && !isAdminUser}
                                                />
                                            </div>
                                            {!incident.closureRequested ? (
                                                <div className="space-y-3">
                                                    <button type="button" onClick={handleSubmitProgress} disabled={!note.trim() || progressLoading}
                                                        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                        {progressLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Activity size={16} className="mr-2 inline" />}
                                                        {progressLoading ? 'Saving...' : 'Save Progress'}
                                                    </button>
                                                    {!isAdminUser ? (
                                                        <button type="button" onClick={() => handleAction('request-closure', { actionTaken: note })}
                                                            disabled={actionLoading || !note.trim()}
                                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                                                            Close Case
                                                        </button>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </DashboardPanel>
                                ) : null}
                            </div>
                        </div>
            </div>
            {letterPermission.open ? (
                <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
                    <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
                        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                                    <Mail className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Create official letter?</h3>
                                    <p className="mt-1 text-sm text-slate-600">
                                        A letter file is available for {letterPermission.categoryName || 'this category'}.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                                Generate the official letter for <strong>{studentNames || 'the selected student'}</strong> in the <strong>{formatDisplayValue(letterPermission.categoryName)}</strong> category?
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-semibold text-slate-800">Available languages</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {letterPermission.templates?.en ? (
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">English ready</span>
                                    ) : null}
                                    {letterPermission.templates?.ta ? (
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Tamil ready</span>
                                    ) : null}
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => setLetterLanguage('en')}
                                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                            letterLanguage === 'en'
                                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        English
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLetterLanguage('ta')}
                                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                            letterLanguage === 'ta'
                                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        Tamil
                                    </button>
                                </div>

                                {!letterPermission.templates?.[letterLanguage] ? (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                                        {letterLanguage === 'ta'
                                            ? 'Tamil letter file is not available for this category.'
                                            : 'English letter file is not available for this category.'}
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid gap-3">
                                <button
                                    type="button"
                                    disabled={!letterPermission.templates?.[letterLanguage] || letterGenerating}
                                    onClick={handleGenerateLetter}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                                >
                                    {letterGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    Yes, create letter
                                </button>

                                <button
                                    type="button"
                                    disabled={letterGenerating}
                                    onClick={() => setLetterPermission({ open: false, templates: null, categoryName: '', loading: false })}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    No, keep incident without letter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default IncidentDetail;
