import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';
import { useNotifications } from '../context/NotificationContext';
import apiClient from '../config/apiClient';
import { API_BASE } from '../config/apiClient';
import { useMasterDataListener } from '../hooks/useMasterDataListener';
import {
    Activity,
    AlertTriangle,
    ArrowLeft,
        Check,
    CheckCircle,
    ChevronDown,
    Download,
    ExternalLink,
    FileImage,
    FilePlus,
    FileText,
    Loader2,
    Lock,
    Mail,
        MessageSquare,
    Plus,
    PlusCircle,
    ShieldAlert,
    Sparkles,
    Trash2,
    UploadCloud,
        UserPlus,
    Users,
    X,
    Zap,
} from 'lucide-react';

import { isAdminRole, isTeacherRole } from '../utils/roles';
import {
    DashboardPanel,
    EmptyStatePanel,
} from '../components/analytics/DashboardPrimitives';
import { formatShortDateTime, getIncidentTimestamp, resolveHandlerLabel, formatDisplayValue, resolveUserLabel, resolveIncidentPriorityForExport } from '../utils/analytics';
import {
    migrateIncidentStorageForUser,
    readUserList,
    writeUserList,
} from '../utils/userStorage';
import { getRecordId, isValidMongoObjectId } from '../utils/ids';
import { downloadBlob, downloadRemoteFile, isNativeDownloadPlatform, openRemoteFile, parseDownloadFilename } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';

const ScannerModal = React.lazy(() => import('../modules/scanner/components/ScannerModal'));

const STATUS_STYLES = {
    Pending: { badge: 'border-orange-200 bg-orange-50 text-orange-700', tone: 'amber' },
    Closed: { badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', tone: 'emerald' },
};


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
    const [activeScanningIndex, setActiveScanningIndex] = useState(null);
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
    const evidenceUploadFormRef = useRef(null);
    const userId = getRecordId(user);
    const [activeDetailSection, setActiveDetailSection] = useState('evidence');
    const activeTab = activeDetailSection;
    const setActiveTab = setActiveDetailSection;

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

    useMasterDataListener(useCallback(() => {
        fetchIncident();
    }, [fetchIncident]));

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

    useEffect(() => {
        if (showUploadForm) {
            evidenceUploadFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [showUploadForm]);

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
        { key: 'evidence', label: 'Evidence', count: evidenceAssets.length, icon: FileImage },
        { key: 'notes', label: 'Progress Updates', count: progressLogs.length, icon: MessageSquare },
        { key: 'assignment', label: 'Handler', icon: UserPlus },
        { key: 'closure', label: 'Closure', icon: Lock },
        canManageIncident ? { key: 'letters', label: 'Letters', count: incident?.letterGenerated || generatedLetter ? 1 : 0, icon: Mail } : null,
    ].filter(Boolean)), [canManageIncident, evidenceAssets.length, generatedLetter, incident?.letterGenerated, progressLogs.length]);
    

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
        <div className="incident-workspace w-full min-w-0 bg-[#f6f8fc] text-slate-800 pb-6">
            {/* Desktop Quick Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="mx-auto max-w-[1680px] flex flex-wrap items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/incidents')}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                        <ArrowLeft size={14} />
                        <span>Back</span>
                    </button>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2">
                        {incident.status !== 'Closed' && canManageIncident && (
                            <button
                                type="button"
                                onClick={() => {
                                    setDescriptionDraft(incident.description || '');
                                    setDescriptionEditing(true);
                                }}
                                className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition shadow-sm"
                            >
                                <FileText size={14} />
                                <span>Edit</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleExportReport}
                            disabled={isExporting}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition shadow-sm disabled:opacity-60"
                        >
                            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            <span>Export</span>
                        </button>
                        {isAdminUser && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition shadow-sm disabled:opacity-60"
                            >
                                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                <span>Delete</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-[1680px] p-4 lg:p-6 space-y-6">
                
                {/* ALERTS */}
                {showRejectionAlert && (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-white p-2 text-red-600 shadow-sm"><ShieldAlert size={18} /></div>
                            <div>
                                <p className="font-bold text-red-800">Re-investigation Required</p>
                                <p className="mt-1 text-sm text-red-700 leading-relaxed">{incident.rejectionReason}</p>
                            </div>
                        </div>
                    </div>
                )}
                {showClosureRequestedAlert && (
                    <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-white p-2 text-amber-600 shadow-sm"><Zap size={18} /></div>
                            <div>
                                <p className="font-bold text-amber-800">Closure Request Pending</p>
                                <p className="mt-1 text-sm text-amber-700 leading-relaxed">
                                    The assigned handler has requested final closure. Admin review is still required.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* THE UNIFIED TOP SUMMARY BANNER CARD */}
                <section className="rounded-xl border border-slate-200 bg-white p-5 lg:p-6 shadow-sm space-y-5">
                    {/* Row 1: Profile & Status */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                <Users size={24} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                                        {studentNames}
                                    </h2>
                                    <span className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-bold uppercase ${statusStyle.badge}`}>
                                        {formatDisplayValue(incident.status || 'Pending')}
                                    </span>
                                    {isAdminUser && incident.admissionNo && (
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/student-analytics/${incident.admissionNo}`)}
                                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                                        >
                                            <ExternalLink size={14} />
                                            <span>View Full Student Report</span>
                                        </button>
                                    )}
                                </div>
                                <p className="mt-1 text-sm font-medium text-slate-500">
                                    Admission No: {incident.admissionNo || 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Row 1 Right: Status dates */}
                        <div className="flex flex-col text-xs text-slate-400 sm:text-right gap-1.5 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0">
                            <div>
                                <span className="font-semibold text-slate-500">Incident Opened:</span>{' '}
                                <span>{formatShortDateTime(getIncidentTimestamp(incident))}</span>
                            </div>
                            {incident.status === 'Closed' && (
                                <div>
                                    <span className="font-semibold text-slate-500">Closed:</span>{' '}
                                    <span>{formatShortDateTime(incident.closedAt || getIncidentTimestamp(incident))}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Grid of basic details - Consolidated Single Source of Truth */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-8 border-t border-b border-slate-100 py-4 text-sm">
                        <div>
                            <span className="block text-xs font-semibold text-slate-400">Class</span>
                            <span className="mt-1 block font-semibold text-slate-800">{incident.class || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-slate-400">Section</span>
                            <span className="mt-1 block font-semibold text-slate-800">{incident.section || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-slate-400">Academic Year</span>
                            <span className="mt-1 block font-semibold text-slate-800">{incident.academicYear || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-slate-400">Priority</span>
                            <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-xs font-bold uppercase ${
                                resolveIncidentPriorityForExport(incident) === 'High Priority'
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-slate-50 text-slate-700 border border-slate-200'
                            }`}>
                                {resolveIncidentPriorityForExport(incident)}
                            </span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-slate-400">Incident Type</span>
                            <span className="mt-1 block font-semibold text-slate-800">{formatDisplayValue(incident.category || 'N/A')}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-slate-400">Location</span>
                            <span className="mt-1 block font-semibold text-slate-800">{formatDisplayValue(incident.location || 'N/A')}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-slate-400">Reporter</span>
                            <span className="mt-1 block font-semibold text-slate-800">{resolveUserLabel(incident.reportedBy)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold text-slate-400">Handler</span>
                            <span className="mt-1 block font-semibold text-slate-800">{resolveHandlerLabel(incident)}</span>
                        </div>
                    </div>

                    {/* Row 3: Description Details */}
                    <div className="space-y-2">
                        <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Description</span>
                        {descriptionEditing ? (
                            <div className="space-y-3">
                                <textarea
                                    id="incident-description-textarea"
                                    aria-label="Edit Incident Description"
                                    className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                    value={descriptionDraft}
                                    maxLength={3000}
                                    onChange={(event) => setDescriptionDraft(event.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveDescription}
                                        disabled={descriptionSaving}
                                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60 shadow-sm"
                                    >
                                        {descriptionSaving ? <Loader2 size={14} className="mr-2 inline animate-spin" /> : <Check size={14} className="mr-2 inline" />}
                                        Save Description
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDescriptionEditing(false)}
                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                                {incident.description || 'No description provided.'}
                            </p>
                        )}
                    </div>
                </section>

                {/* FULL-WIDTH TABS WORKSPACE LAYOUT */}
                <div className="space-y-6">
                    
                    {/* THE NAVIGATION TABS BAR */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sticky top-[76px] z-20">
                        <div className="flex overflow-x-auto scrollbar-none" role="tablist" aria-label="Incident Workspace Tabs">
                            {detailTabs.map(({ key, label, count, icon: Icon }) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === key}
                                    onClick={() => setActiveTab(key)}
                                    className={`flex-1 inline-flex min-w-[120px] items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-sm font-bold transition ${
                                        activeTab === key
                                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-extrabold'
                                            : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                    }`}
                                >
                                    <Icon size={15} />
                                    <span>{label}</span>
                                    {count ? (
                                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                                            {count}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* TAB PANEL CONTENTS */}
                    <div className="min-h-[300px]">
                        {activeTab === 'evidence' && (
                            <div className="space-y-6 animate-fadeIn">
                                <DashboardPanel
                                    title="Evidence Locker"
                                    description="Supporting documents, photos, or audio logs attached to this case file."
                                    icon={FileImage}
                                    actions={incident.status !== 'Closed' && canManageIncident ? (
                                        <button
                                            type="button"
                                            onClick={handleOpenEvidenceForm}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-sm font-bold text-white hover:bg-indigo-700 transition shadow-sm"
                                        >
                                            <Plus size={16} />
                                            <span>Add Evidence</span>
                                        </button>
                                    ) : null}
                                >
                                    {evidenceAssets.length === 0 ? (
                                        <EmptyStatePanel title="No evidence items" description="Attach photos or documents here as supporting materials for validation." />
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                                            {evidenceAssets.map((entry, index) => {
                                                const fileUrl = resolveFileUrl(entry?.fileUrl);
                                                const previewUrl = withEvidenceDisposition(fileUrl, 'inline');
                                                const fileLabel = getEvidenceFilename(entry, `${entry?.evidenceType || 'Evidence'} file ${index + 1}`);
                                                return (
                                                    <div key={`${entry?.fileUrl || entry?.evidenceType}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
                                                        <div>
                                                            <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                                                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                                                                    {entry?.evidenceType || 'Evidence'}
                                                                </span>
                                                            </div>
                                                            <div className="relative mt-2">
                                                                {previewUrl ? (
                                                                    <EvidenceFilePreview src={previewUrl} alt={entry?.evidenceType || `Evidence ${index + 1}`} />
                                                                ) : (
                                                                    <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                                                                        Preview not available
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 flex gap-2">
                                                            {fileUrl && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEvidenceFile(fileUrl, fileLabel)}
                                                                        className="flex-1 inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                                    >
                                                                        <ExternalLink size={13} />
                                                                        <span>View</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDownloadEvidenceFile(fileUrl, fileLabel)}
                                                                        className="flex-1 inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
                                                                    >
                                                                        <Download size={13} />
                                                                        <span>Download</span>
                                                                    </button>
                                                                </>
                                                            )}
                                                            {incident.status !== 'Closed' && canManageIncident && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteEvidence(entry)}
                                                                    disabled={deletingEvidenceId === getRecordId(entry)}
                                                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-60"
                                                                    aria-label="Delete Evidence"
                                                                >
                                                                    {deletingEvidenceId === getRecordId(entry) ? (
                                                                        <Loader2 size={14} className="animate-spin" />
                                                                    ) : (
                                                                        <Trash2 size={14} />
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Upload Form Dialog Box */}
                                    {showUploadForm && (
                                        <div ref={evidenceUploadFormRef} className="mt-6 scroll-mt-28 rounded-xl border border-indigo-100 bg-indigo-50/20 p-5 shadow-inner">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-indigo-100/55 pb-4">
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-900">Upload Evidence Files</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5">Drag files into the zones or tap to select files.</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleAddEvidenceEntry}
                                                        className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                                                    >
                                                        <PlusCircle size={14} className="mr-1 inline" />Add Row
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleCancelEvidenceForm}
                                                        disabled={evidenceLoading}
                                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-4">
                                                {evidenceEntries.map((entry, index) => (
                                                    <div key={`ev-entry-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                                        <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                                                            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">File Attachment {index + 1}</span>
                                                            {evidenceEntries.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveEvidenceEntry(index)}
                                                                        className="text-slate-400 hover:text-red-600 transition"
                                                                    >
                                                                        <X size={15} />
                                                                    </button>
                                                            )}
                                                        </div>
                                                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                                                            <div>
                                                                <label htmlFor={`evidence-cat-select-${index}`} className="block text-xs font-bold text-slate-500 mb-1">Evidence Type</label>
                                                                <div className="relative">
                                                                    <select
                                                                        id={`evidence-cat-select-${index}`}
                                                                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
                                                                        value={entry.evidenceType}
                                                                        onChange={(e) => handleEvidenceTypeChange(index, e.target.value)}
                                                                    >
                                                                        <option value="" disabled>Select Category</option>
                                                                        {evidenceTypes.map((type) => {
                                                                            const label = type?.name || type;
                                                                            return <option key={getRecordId(type) || label} value={label}>{label}</option>;
                                                                        })}
                                                                    </select>
                                                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 mb-1">File Attachment</label>
                                                                <label
                                                                    htmlFor={`evidence-file-input-${index}`}
                                                                    className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-slate-50/50 py-4 px-4 text-center cursor-pointer transition hover:bg-slate-50 ${
                                                                        dragActiveIndex === index ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-300'
                                                                    }`}
                                                                    onDragOver={(e) => { e.preventDefault(); setDragActiveIndex(index); }}
                                                                    onDragLeave={(e) => { e.preventDefault(); setDragActiveIndex(null); }}
                                                                    onDrop={(e) => {
                                                                        e.preventDefault(); setDragActiveIndex(null);
                                                                        const f = e.dataTransfer.files?.[0];
                                                                        if (f) handleEvidenceFileChange(index, f);
                                                                    }}
                                                                >
                                                                    <UploadCloud size={18} className="text-slate-400 mb-1" />
                                                                    <span className="text-xs font-bold text-slate-600">
                                                                        {entry.file ? 'Replace File' : 'Click/Drag File'}
                                                                    </span>
                                                                    <input
                                                                        id={`evidence-file-input-${index}`}
                                                                        type="file"
                                                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                                                        className="hidden"
                                                                        aria-label="Upload File Input"
                                                                        onChange={(e) => {
                                                                            const f = e.target.files?.[0];
                                                                            if (f) handleEvidenceFileChange(index, f);
                                                                            e.target.value = '';
                                                                        }}
                                                                    />
                                                                </label>
                                                            </div>
                                                        </div>

                                                        {entry.file && (
                                                            <div className="mt-3 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50/50 p-2 text-xs">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <FilePlus size={14} className="text-indigo-600 shrink-0" />
                                                                    <span className="font-semibold text-slate-700 truncate">{entry.file.name}</span>
                                                                    <span className="text-slate-400">({formatFileSize(entry.file.size)})</span>
                                                                </div>
                                                                {evidenceUploadDone ? (
                                                                    <Check size={14} className="text-emerald-600" />
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveEvidenceFile(index)}
                                                                        className="text-slate-400 hover:text-red-600"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                                                        {entry.file && entry.file.type?.startsWith('image/') && (
                                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setActiveScanningIndex(index)}
                                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-100"
                                                                    title="Open document scanner studio to crop and enhance document"
                                                                >
                                                                    <Sparkles size={13} className="text-indigo-600" />
                                                                    Scan Document
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={submitEvidence}
                                                disabled={evidenceLoading || !evidenceEntries.some((e) => e.file)}
                                                className="mt-4 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                                            >
                                                {evidenceLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <UploadCloud size={16} className="mr-2 inline" />}
                                                {evidenceLoading ? 'Saving Evidence...' : 'Save Uploaded Evidence'}
                                            </button>
                                        </div>
                                    )}
                                </DashboardPanel>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div className="grid grid-cols-1 gap-6 animate-fadeIn">
                                {/* Notes logging list */}
                                <DashboardPanel title="Case updates log" icon={MessageSquare}>
                                    {progressLogs.length === 0 ? (
                                        <EmptyStatePanel title="No notes recorded yet" description="Internal records will appear in chronological sequence as saved." />
                                    ) : (
                                        <div className="space-y-4">
                                            {progressLogs.map((log, index) => (
                                                <div key={`${log.timestamp || index}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm">
                                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div className="flex items-start gap-2.5">
                                                                <div className="rounded-lg bg-white p-2 text-indigo-600 shadow-sm"><MessageSquare size={16} /></div>
                                                            <div>
                                                                <span className="block text-sm font-bold text-slate-800">{log.updatedBy || 'System Update'}</span>
                                                                <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{log.note}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                                                            {formatShortDateTime(log.timestamp)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </DashboardPanel>

                                {/* Quick Add Custom Notes Panel */}
                                {incident.status !== 'Closed' && showFieldUpdates ? (
                                    <DashboardPanel
                                        title="Log Custom Note"
                                        icon={Plus}
                                        actions={(
                                            <button
                                                type="button"
                                                onClick={() => setEditMode((v) => !v)}
                                                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                                    editMode
                                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                {editMode ? 'Done' : 'Edit Presets'}
                                            </button>
                                        )}
                                    >
                                        <div className="space-y-4">
                                            {/* Preset Selects */}
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Quick Select Notes</span>
                                                <div className="space-y-1.5">
                                                    {(fieldOptions || []).map((option) => (
                                                        <div
                                                            key={getRecordId(option)}
                                                            className={`flex items-center justify-between rounded-xl border p-2.5 transition ${
                                                                editMode
                                                                    ? 'border-slate-200 bg-slate-50'
                                                                    : 'cursor-pointer border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/55'
                                                            }`}
                                                            onClick={() => { if (!editMode) handleSelectOption(option); }}
                                                        >
                                                            <span className="text-xs font-semibold text-slate-700">{option.label}</span>
                                                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                                                {editMode ? (
                                                                    <Trash2
                                                                        size={12}
                                                                        className="cursor-pointer text-slate-400 hover:text-red-600"
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteOption(getRecordId(option)); }}
                                                                    />
                                                                ) : (
                                                                    <CheckCircle size={12} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(fieldOptions || []).length === 0 && (
                                                        <p className="text-xs text-slate-400">No quick presets defined.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {editMode && (
                                                <div className="flex gap-1.5">
                                                    <input
                                                        type="text"
                                                        aria-label="New Preset Label"
                                                        value={newOptionLabel}
                                                        onChange={(e) => setNewOptionLabel(e.target.value)}
                                                        placeholder="New preset label..."
                                                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition focus:border-indigo-500"
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddOption(); }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddOption}
                                                        disabled={!newOptionLabel.trim()}
                                                        className="rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            )}

                                            <div className="border-t border-slate-100 pt-3">
                                                <label htmlFor="notes-tab-textarea" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Custom Remark</label>
                                                <textarea
                                                    id="notes-tab-textarea"
                                                    className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
                                                    placeholder="Log details or additional status remarks..."
                                                    value={note}
                                                    onChange={(e) => setNote(e.target.value)}
                                                    disabled={incident.closureRequested && !isAdminUser}
                                                />
                                            </div>

                                            {!incident.closureRequested && (
                                                <button
                                                    type="button"
                                                    onClick={handleSubmitProgress}
                                                    disabled={!note.trim() || progressLoading}
                                                    className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                                                >
                                                    {progressLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Activity size={16} className="mr-2 inline" />}
                                                    <span>Save Internal Note</span>
                                                </button>
                                            )}
                                        </div>
                                    </DashboardPanel>
                                ) : (
                                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                                        <p className="text-xs text-slate-400">Note submission is locked because the case is resolved or you do not have edit rights.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'assignment' && (
                            <div className="space-y-6 animate-fadeIn">
                                <DashboardPanel title="Case Assignment Ownership" icon={UserPlus}>
                                    <div className="space-y-4">
                                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm">
                                            <div>
                                                <span className="block text-xs font-semibold text-slate-400">Assigned Handler</span>
                                                <span className="mt-1 block font-bold text-slate-800">{resolveHandlerLabel(incident)}</span>
                                            </div>
                                            <div className="text-xs text-slate-400 sm:text-right">
                                                Incident Opened: {formatShortDateTime(getIncidentTimestamp(incident))}
                                            </div>
                                        </div>
                                        
                                        {showCaseAllocation ? (
                                            <div className="space-y-3 border-t border-slate-100 pt-4">
                                                <label htmlFor="choose-handler-select" className="block text-xs font-bold text-slate-500">Assign/Reassign Handler</label>
                                                <div className="flex flex-col gap-2.5 sm:flex-row">
                                                    <div className="relative flex-1">
                                                        <select
                                                            id="choose-handler-select"
                                                            aria-label="Choose Handler"
                                                            className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-10 py-2.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-500"
                                                            value={selectedHandler}
                                                            onChange={(e) => setSelectedHandler(e.target.value)}
                                                        >
                                                            <option value="">Choose Handler</option>
                                                            {staffList.map((staff) => (
                                                                <option key={getRecordId(staff)} value={getRecordId(staff)}>
                                                                    {resolveUserLabel(staff)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAction('assign', { handlerId: selectedHandler })}
                                                        disabled={!selectedHandler || actionLoading}
                                                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60 shadow-sm"
                                                    >
                                                        Assign Handler
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleAssignToMyself}
                                                        disabled={!userId || actionLoading}
                                                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
                                                    >
                                                        Assign to Myself
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                                                <p className="text-xs text-slate-400">Assignment controls are locked because this case is resolved or you lack management rights.</p>
                                            </div>
                                        )}
                                    </div>
                                </DashboardPanel>
                            </div>
                        )}

                        {activeTab === 'closure' && (
                            <div className="space-y-6 animate-fadeIn">
                                <DashboardPanel title="Case Closure & Resolutions" icon={Lock}>
                                    <div className="space-y-6">
                                        {incident.status === 'Closed' ? (
                                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/55 p-6 text-center">
                                                <CheckCircle size={32} className="mx-auto text-emerald-600 mb-2" />
                                                <p className="font-bold text-emerald-800">This case has been resolved and closed.</p>
                                                {incident.closureNote && (
                                                    <div className="mt-3 rounded-lg bg-white p-3 border border-emerald-100 text-left text-xs text-slate-700">
                                                        <span className="font-bold text-slate-500">Resolution Note:</span>
                                                        <p className="mt-1 whitespace-pre-wrap">{incident.closureNote}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {/* Close Case (For Handler/Teacher - request closure) */}
                                                {showFieldUpdates && !isAdminUser && !incident.closureRequested && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                                            <Lock size={16} className="text-indigo-600" />
                                                            <span>Submit Closure Request</span>
                                                        </h4>
                                                        <p className="text-xs text-slate-500">
                                                            Explain the actions taken and results before requesting incident closure. Write your notes in the custom note field below.
                                                        </p>
                                                        <div className="space-y-3">
                                                            <textarea
                                                                aria-label="Closure note action taken"
                                                                placeholder="Describe the action to resolve this incident..."
                                                                className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
                                                                value={note}
                                                                onChange={(e) => setNote(e.target.value)}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAction('request-closure', { actionTaken: note })}
                                                                disabled={actionLoading || !note.trim()}
                                                                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60 shadow-sm"
                                                            >
                                                                {actionLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : null}
                                                                Submit Closure Request
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Close Incident (For Admin - Finalize closure or Return) */}
                                                {showAdminCommand && (
                                                    <div className="space-y-3">
                                                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                                            <CheckCircle size={16} className="text-indigo-600" />
                                                            <span>Close/Review Incident</span>
                                                        </h4>
                                                        <textarea
                                                            aria-label="Decision or closure note"
                                                            className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
                                                            placeholder="Add a final resolution decision or closure note (optional)"
                                                            value={adminFinalNote}
                                                            onChange={(e) => setAdminFinalNote(e.target.value)}
                                                        />
                                                        <div className="flex flex-col gap-2 sm:flex-row">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAction('finalize-closure', { note: adminFinalNote })}
                                                                disabled={actionLoading}
                                                                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:opacity-60 shadow-sm"
                                                            >
                                                                {actionLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : null}
                                                                Finalize and Close Case
                                                            </button>
                                                            {incident.closureRequested && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAction('reject-closure', { reason: adminFinalNote })}
                                                                    disabled={actionLoading}
                                                                    className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 transition disabled:opacity-60 shadow-sm"
                                                                >
                                                                    Return to Handler (Request Re-investigation)
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {!showFieldUpdates && !showAdminCommand && (
                                                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                                                        <p className="text-xs text-slate-400">Closure workflow controls are only accessible to assigned handlers and administrators.</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </DashboardPanel>
                            </div>
                        )}

                        {activeTab === 'letters' && (
                            <div className="space-y-6 animate-fadeIn">
                                <DashboardPanel title="Official Documentation" icon={Mail}>
                                    {incident.letterGenerated || generatedLetter ? (
                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/55 p-5 shadow-sm space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-xl bg-white p-2.5 text-emerald-600 shadow-sm">
                                                    <Mail size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-emerald-800">
                                                        {generatedLetter?.letterNumber || incident.letterGenerated?.letterNumber || 'Letter Generated'}
                                                    </p>
                                                    <p className="text-xs text-emerald-600">
                                                        Letter Template Layout: {generatedLetter?.templateName || incident.letterGenerated?.templateName || 'School standard'}
                                                    </p>
                                                </div>
                                            </div>
                                            {isAdminUser && (
                                                <button
                                                    type="button"
                                                    onClick={handleGeneratedLetterDownload}
                                                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-sm"
                                                >
                                                    <Download size={15} />
                                                    <span>Download Document (Word Format)</span>
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6 text-center space-y-3">
                                            <Mail size={32} className="mx-auto text-slate-400" />
                                            <div>
                                                <h4 className="font-bold text-slate-800">No official letter issued yet</h4>
                                                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                                    Generate an official letter layout using pre-configured categories when documents are complete.
                                                </p>
                                            </div>
                                            {canManageIncident && (
                                                <button
                                                    type="button"
                                                    onClick={handleOpenLetterPermission}
                                                    disabled={letterGenerating || letterPermission.loading}
                                                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60 shadow-sm"
                                                >
                                                    {letterGenerating || letterPermission.loading ? (
                                                        <Loader2 size={15} className="animate-spin" />
                                                    ) : (
                                                        <FileText size={15} />
                                                    )}
                                                    <span>Generate Official Letter</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </DashboardPanel>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Letter Generation Modal overlay (same logic) */}
            {letterPermission.open ? (
                <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
                    <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl animate-scaleUp">
                        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/55 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                                    <Mail className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Create Official Letter?</h3>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        An official letter template is defined for category: {letterPermission.categoryName || 'this category'}.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                                Generate the official letter for student <strong>{studentNames || 'involved student'}</strong> in category <strong>{formatDisplayValue(letterPermission.categoryName)}</strong>?
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">Available Languages</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {letterPermission.templates?.en ? (
                                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">English Supported</span>
                                    ) : null}
                                    {letterPermission.templates?.ta ? (
                                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Tamil Supported</span>
                                    ) : null}
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => setLetterLanguage('en')}
                                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                            letterLanguage === 'en'
                                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-bold'
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
                                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-bold'
                                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        Tamil
                                    </button>
                                </div>

                                {!letterPermission.templates?.[letterLanguage] && (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
                                        Selected language ({letterLanguage === 'ta' ? 'Tamil' : 'English'}) template file is not configured.
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-3">
                                <button
                                    type="button"
                                    disabled={!letterPermission.templates?.[letterLanguage] || letterGenerating}
                                    onClick={handleGenerateLetter}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {letterGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    <span>Yes, Generate Letter</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={letterGenerating}
                                    onClick={() => setLetterPermission({ open: false, templates: null, categoryName: '', loading: false })}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                    No, Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {activeScanningIndex !== null && (
                <React.Suspense fallback={null}>
                    <ScannerModal
                        open={activeScanningIndex !== null}
                        file={evidenceEntries[activeScanningIndex]?.file}
                        onComplete={(scannedFile) => {
                            const targetIdx = activeScanningIndex;
                            setActiveScanningIndex(null);
                            handleEvidenceFileChange(targetIdx, scannedFile);
                            addToast('Improved document copy applied to Evidence attachment.', 'success');
                        }}
                        onCancel={() => {
                            const targetIdx = activeScanningIndex;
                            setActiveScanningIndex(null);
                            if (targetIdx !== null && evidenceEntries[targetIdx]?.file) {
                                handleEvidenceFileChange(targetIdx, evidenceEntries[targetIdx].file);
                            }
                        }}
                    />
                </React.Suspense>
            )}
        </div>
    );
};

export default IncidentDetail;
