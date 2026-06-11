import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
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
    DashboardHero,
    DashboardPanel,
    DashboardStatCard,
    EmptyStatePanel,
} from '../components/analytics/DashboardPrimitives';
import { formatShortDate, formatShortDateTime, getIncidentTimestamp, resolveHandlerLabel } from '../utils/analytics';
import {
    migrateIncidentStorageForUser,
    readUserList,
    writeUserList,
} from '../utils/userStorage';
import { getRecordId, isValidMongoObjectId } from '../utils/ids';
import { downloadBlob, downloadRemoteFile, isNativeDownloadPlatform, openRemoteFile, parseDownloadFilename } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';

const STATUS_STYLES = {
    Open: { badge: 'border-orange-200 bg-orange-50 text-orange-700', tone: 'amber' },
    'In Progress': { badge: 'border-blue-200 bg-blue-50 text-blue-700', tone: 'blue' },
    Closed: { badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', tone: 'emerald' },
};

const FIELD_CARD_CLASS =
    'rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-200/40';

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

const EvidenceFilePreview = ({ src, alt }) => {
    const [objectUrl, setObjectUrl] = useState('');
    const [previewType, setPreviewType] = useState('');
    const [failed, setFailed] = useState(false);
    const activeObjectUrlRef = useRef('');

    useEffect(() => {
        let cancelled = false;
        let createdObjectUrl = '';

        const revokeActiveObjectUrl = () => {
            if (!activeObjectUrlRef.current) return;
            window.URL.revokeObjectURL(activeObjectUrlRef.current);
            activeObjectUrlRef.current = '';
        };

        revokeActiveObjectUrl();
        setObjectUrl('');
        setPreviewType('');
        setFailed(false);

        if (!src) return undefined;

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

            createdObjectUrl = window.URL.createObjectURL(response.data);
            if (!cancelled) {
                activeObjectUrlRef.current = createdObjectUrl;
                setPreviewType(canPreviewPdf ? 'pdf' : 'image');
                setObjectUrl(createdObjectUrl);
            } else {
                window.URL.revokeObjectURL(createdObjectUrl);
            }
        }).catch(() => {
            if (!cancelled) setFailed(true);
        });

        return () => {
            cancelled = true;
            if (createdObjectUrl && activeObjectUrlRef.current === createdObjectUrl) {
                revokeActiveObjectUrl();
            }
        };
    }, [src]);

    if (failed) {
        return (
            <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-500">
                Preview unavailable
            </div>
        );
    }

    if (!objectUrl) {
        return (
            <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-500">
                Loading preview...
            </div>
        );
    }

    if (previewType === 'image') {
        return (
        <img
            src={objectUrl}
            alt={alt}
            className="mt-4 h-44 w-full rounded-2xl border border-slate-200 object-cover"
        />
        );
    }

    if (previewType === 'pdf') {
        return (
            <iframe
                src={objectUrl}
                title={alt}
                className="mt-4 h-44 w-full rounded-2xl border border-slate-200 bg-white"
            />
        );
    }

    return (
        <div className="mt-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-500">
            Preview unavailable
        </div>
    );
};

const DetailField = ({ icon: Icon, label, value, helper = null, action = null }) => (
    <div className={FIELD_CARD_CLASS}>
        <div className="flex items-start gap-3">
            {Icon ? (
                <div className="rounded-2xl bg-white p-2.5 text-slate-600 shadow-sm shadow-slate-200/70">
                    <Icon size={18} />
                </div>
            ) : null}
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
                <div className="mt-2 text-sm font-semibold text-slate-900">{value || 'N/A'}</div>
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
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${step.surfaceClass}`}>
                    <Icon size={18} className={step.iconClass} />
                </div>
                {!isLast ? <div className="mt-3 h-full min-h-[48px] w-px bg-slate-200" /> : null}
            </div>
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm shadow-slate-200/40">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                        {step.note ? <p className="mt-1 text-sm text-slate-500">{step.note}</p> : null}
                    </div>
                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
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
    const [activeFieldTab, setActiveFieldTab] = useState('handler');
    const [editMode, setEditMode] = useState(false);
    const [fieldOptions, setFieldOptions] = useState({ handler: [], assigner: [] });
    const [newOptionLabel, setNewOptionLabel] = useState('');
    const [generatedLetter, setGeneratedLetter] = useState(null);
    const [progressLoading, setProgressLoading] = useState(false);
    const [evidenceTypes, setEvidenceTypes] = useState([]);
    const [evidenceEntries, setEvidenceEntries] = useState([{ evidenceType: '', file: null, preview: null }]);
    const [evidenceLoading, setEvidenceLoading] = useState(false);
    const [dragActiveIndex, setDragActiveIndex] = useState(null);
    const [evidenceUploadDone, setEvidenceUploadDone] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const exportInFlightRef = useRef(false);
    const deleteInFlightRef = useRef(false);
    const markedIncidentReadRef = useRef('');
    const userId = getRecordId(user);

    const fetchFieldOptions = useCallback(async () => {
        try {
            const [handlerOpts, assignerOpts, evidenceOpts] = await Promise.all([
                apiClient.get('/api/field-operation-options?type=handler'),
                apiClient.get('/api/field-operation-options?type=assigner'),
                apiClient.get('/api/evidence-types'),
            ]);
            setFieldOptions({
                handler: Array.isArray(handlerOpts.data) ? handlerOpts.data : [],
                assigner: Array.isArray(assignerOpts.data) ? assignerOpts.data : [],
            });
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
            await apiClient.post('/api/field-operation-options', { type: activeFieldTab, label: newOptionLabel.trim() });
            setNewOptionLabel('');
            fetchFieldOptions();
        } catch (err) {
            addToast(err.response?.data?.message || 'Failed to add option.', 'error');
        }
    };

    const handleDeleteOption = async (optionId) => {
        if (!window.confirm('Delete this option?')) return;
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
        if (!['Super Admin', 'Admin'].includes(user?.role) || !userId) return;
        try {
            const { data } = await apiClient.get('/api/auth/users');
            setStaffList(Array.isArray(data) ? data : []);
        } catch {
            setStaffList([]);
        }
    }, [user?.role, userId]);

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

    const handleDelete = useCallback(async () => {
        if (deleteInFlightRef.current) return;
        if (!window.confirm('Permanently delete this incident? This cannot be undone.')) return;
        deleteInFlightRef.current = true;
        setIsDeleting(true);
        try {
            await apiClient.delete(`/api/incidents/${id}`);
            navigate('/incidents');
        } catch (err) {
            alert(err.response?.data?.message || err.message || 'Delete failed.');
        } finally {
            deleteInFlightRef.current = false;
            setIsDeleting(false);
        }
    }, [id, navigate]);

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
        const messages = {
            approve: 'Authorize and assign this case?',
            progress: 'Add this progress note?',
            'request-closure': 'Request case closure?',
            'finalize-closure': 'Finalize and close this case?',
            'reject-closure': 'Reject closure and return to handler?',
        };
        if (!window.confirm(messages[path] || `Proceed with ${path}?`)) return;
        try {
            setActionLoading(true);
            await apiClient.put(`/api/incidents/${id}/${path}`, payload);
            setAdminFinalNote('');
            setNote('');
            await fetchIncident();
        } catch (err) {
            alert(err.response?.data?.message || 'Action failed.');
        } finally {
            setActionLoading(false);
        }
    }, [fetchIncident, id]);

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
        if (['Super Admin', 'Admin'].includes(user.role)) return true;
        return Boolean(incident.assignedHandler && getRecordId(incident.assignedHandler) === userId);
    }, [incident, user, userId]);

    const timelineData = useMemo(() => {
        if (!incident) return [];
        const status = incident.status || 'Open';
        const steps = [];
        const openedTime = getIncidentTimestamp(incident);
        if (openedTime) {
            steps.push({
                label: 'Incident Registered', time: openedTime,
                note: 'Manual timeline date is used as the primary opened timestamp for this case.',
                icon: Activity, surfaceClass: 'bg-blue-50', iconClass: 'text-blue-600',
            });
        }
        if (incident.approvedAt) {
            steps.push({
                label: 'Case Authorized', time: incident.approvedAt,
                note: incident.assignedHandler?.name ? `Assigned to ${incident.assignedHandler.name}.` : 'Authorization recorded before assignment.',
                icon: ShieldCheck, surfaceClass: 'bg-amber-50', iconClass: 'text-amber-600',
            });
        }
        const progressTime = incident.inProgressAt || incident.progressAt;
        if (progressTime && (status === 'In Progress' || status === 'Closed')) {
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
    const heroDescription = useMemo(() => {
        if (!incident) return 'Review incident details and progress.';
        return 'Review incident details and progress.';
    }, [incident]);

    const showRejectionAlert = Boolean(incident?.rejectionReason && !incident?.closureRequested && incident?.status !== 'Closed');
    const showClosureRequestedAlert = Boolean(incident?.closureRequested && incident?.status !== 'Closed');
    const showCaseAllocation = Boolean(['Super Admin', 'Admin'].includes(user?.role) && incident?.approvalStatus === 'Pending');
    const showAdminCommand = Boolean(['Super Admin', 'Admin'].includes(user?.role) && incident?.status !== 'Closed' && incident?.approvalStatus === 'Approved');
    const showFieldUpdates = Boolean(isHandler && incident?.status !== 'Closed' && incident?.approvalStatus === 'Approved');

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
        <div className="w-full min-w-0 p-4 lg:p-6">
            <div className="mx-auto max-w-[1600px] space-y-6">
                        <DashboardHero
                            eyebrow="Case Management"
                            title={incident.title || 'Untitled Incident'}
                            description={heroDescription}
                            icon={ShieldCheck}
                            actions={(
                                <>
                                    <button type="button" onClick={() => navigate('/incidents')}
                                        aria-label="Back to incident list"
                                        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                                        <ArrowLeft size={16} className="mr-2 inline" />Back to List
                                    </button>
                                    <button type="button" onClick={handleExportReport} disabled={isExporting}
                                        className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60">
                                        {isExporting ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Download size={16} className="mr-2 inline" />}
                                        Export Report
                                    </button>
                                    {['Super Admin', 'Admin'].includes(user?.role) ? (
                                        <button type="button" onClick={handleDelete} disabled={isDeleting}
                                            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                                            {isDeleting ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Trash2 size={16} className="mr-2 inline" />}
                                            Delete Incident
                                        </button>
                                    ) : null}
                                </>
                            )}
                            meta={(
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 font-semibold ${statusStyle.badge}`}>
                                        {incident.status || 'Open'}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
                                        {incident.approvalStatus || 'Pending'}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                        Incident Date: {formatShortDate(getIncidentTimestamp(incident))}
                                    </span>
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                        Handler: {resolveHandlerLabel(incident)}
                                    </span>
                                    {incident.isHighPriority ? (
                                        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 font-semibold text-orange-700">
                                            High Priority
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        />

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

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <DashboardStatCard
                                title="Current Status" value={incident.status || 'Open'}
                                icon={incident.status === 'Closed' ? CheckCircle : incident.status === 'In Progress' ? Clock : AlertTriangle}
                                tone={statusStyle.tone} helper="Current incident status"
                            />
                            <DashboardStatCard
                                title="Assigned To"
                                value={resolveHandlerLabel(incident)}
                                icon={UserCheck} tone={incident.assignedHandler ? 'blue' : 'amber'}
                                helper={['Super Admin', 'Admin', 'super_admin', 'admin'].includes(incident.assignedHandler?.role) ? 'Administration' : (incident.assignedHandler?.role || 'Awaiting ownership')}
                            />
                            <DashboardStatCard title="Evidence Files" value={evidenceAssets.length} icon={FileImage} tone="slate" helper="Supporting files currently attached" />
                            <DashboardStatCard title="Progress Entries" value={progressLogs.length} icon={Activity} tone="blue" helper="Operational notes on the case" />
                        </div>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                            <DashboardPanel className="xl:col-span-4" title="Student Information" description="Student identity and class placement for this incident." icon={Users}>
                                <div className="grid gap-4">
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
                                </div>
                            </DashboardPanel>

                            <DashboardPanel className="xl:col-span-4" title="Incident Details" description="Where the incident happened and what was reported." icon={MessageSquare}>
                                <div className="grid gap-4">
                                    <DetailField icon={FileText} label="Category" value={incident.category || 'N/A'} />
                                    <DetailField icon={MapPin} label="Location" value={incident.location || 'N/A'} />
                                    <DetailField icon={Calendar} label="Incident Date" value={formatShortDate(getIncidentTimestamp(incident))} helper="Date the incident occurred." />
                                    <div className={FIELD_CARD_CLASS}>
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-2xl bg-white p-2.5 text-slate-600 shadow-sm shadow-slate-200/70"><MessageSquare size={18} /></div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Description</p>
                                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                                    {incident.description || 'No description provided.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </DashboardPanel>

                            <DashboardPanel className="xl:col-span-4" title="Case Administration" description="Who reported the case, who is handling it, and key dates." icon={ShieldCheck}>
                                <div className="grid gap-4">
                                    <DetailField icon={ShieldCheck} label="Reported By" value={incident.reportedBy?.name || 'N/A'} helper={incident.reportedBy?.role || 'Reporter'} />
                                    <DetailField icon={UserCheck} label="Assigned Handler"
                                        value={resolveHandlerLabel(incident)}
                                        helper={['Super Admin', 'Admin', 'super_admin', 'admin'].includes(incident.assignedHandler?.role) ? 'Administration' : (incident.assignedHandler?.role || 'Waiting for assignment')}
                                    />
                                    <DetailField icon={Calendar} label="Opened" value={formatShortDateTime(getIncidentTimestamp(incident))} />
                                    <DetailField icon={Activity} label="Last Updated" value={formatShortDateTime(incident.updatedAt || incident.closedAt || getIncidentTimestamp(incident))} />
                                </div>
                            </DashboardPanel>
                        </div>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                            <div className="space-y-6 xl:col-span-8">
                                <DashboardPanel title="Case History" description="Important milestones as this case moves from opened through closed." icon={Clock}>
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

                                <DashboardPanel
                                    title="Evidence Records"
                                    description="Uploaded files and supporting documents attached to this case."
                                    icon={FileImage}
                                    actions={incident.status !== 'Closed' && ['Super Admin', 'Admin', 'Teacher'].includes(user?.role) ? (
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
                                                                <p className="mt-2 break-all text-sm font-semibold text-slate-900">{fileLabel}</p>
                                                            </div>
                                                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                                Asset {index + 1}
                                                            </span>
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
                                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Evidence {index + 1}</p>
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
                                                                    aria-label={`Evidence ${index + 1} file`}
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

                                <DashboardPanel title="Case Updates" description="Notes from staff, follow-up steps, and decisions along the way." icon={Activity}>
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

                            <div className="space-y-6 xl:col-span-4">
                                {(incident.letterGenerated || generatedLetter) && ['Super Admin', 'Admin'].includes(user?.role) ? (
                                    <DashboardPanel title="Generated Letter" description="Official letter linked to this case." icon={FileText}>
                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                                            <p className="text-sm font-semibold text-emerald-800">
                                                {generatedLetter?.letterNumber || incident.letterGenerated?.letterNumber || 'Letter Generated'}
                                            </p>
                                            <p className="mt-1 text-sm text-emerald-700">
                                                Letter layout: {generatedLetter?.templateName || incident.letterGenerated?.templateName || 'School standard'}
                                            </p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button type="button" onClick={handleGeneratedLetterDownload}
                                                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                                                    <Download size={16} className="mr-2 inline" />Download Word file
                                                </button>
                                            </div>
                                        </div>
                                    </DashboardPanel>
                                ) : null}

                                {showCaseAllocation ? (
                                    <DashboardPanel title="Assign Investigator" description="Authorize this case and assign a staff member to handle it." icon={UserPlus}>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Select Investigator</label>
                                                <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    value={selectedHandler} onChange={(e) => setSelectedHandler(e.target.value)}>
                                                    <option value="">Choose investigator...</option>
                                                    {staffList.map((staff) => (
                                                        <option key={getRecordId(staff)} value={getRecordId(staff)}>{staff.name} ({staff.role})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button type="button" onClick={() => handleAction('approve', { handlerId: selectedHandler })}
                                                disabled={!selectedHandler || actionLoading}
                                                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                {actionLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : null}
                                                Assign Selected Investigator
                                            </button>
                                            <button type="button" onClick={() => handleAction('approve', { handlerId: userId })}
                                                disabled={actionLoading}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                                                Assign to Myself
                                            </button>
                                        </div>
                                    </DashboardPanel>
                                ) : null}

                                {showAdminCommand ? (
                                    <DashboardPanel title="Administrative Actions" description="Finalize the case or return it to the handler with a decision note." icon={Lock}>
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
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                                                <button type="button" onClick={() => { setActiveFieldTab('handler'); setEditMode(false); }}
                                                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${activeFieldTab === 'handler' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}>
                                                    Handler Updates
                                                </button>
                                                {['Super Admin', 'Admin'].includes(user?.role) ? (
                                                    <button type="button" onClick={() => { setActiveFieldTab('assigner'); setEditMode(false); }}
                                                        className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${activeFieldTab === 'assigner' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'}`}>
                                                        Assigner Actions
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="mt-4 space-y-4">
                                            <div className="space-y-2">
                                                {(fieldOptions[activeFieldTab] || []).map((option) => (
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
                                                {(fieldOptions[activeFieldTab] || []).length === 0 ? (
                                                    <EmptyStatePanel title="No preset updates yet" description="Add preset options to speed up handler and assigner workflows." />
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
                                                    disabled={incident.closureRequested && !['Super Admin', 'Admin'].includes(user?.role)}
                                                />
                                            </div>
                                            {!incident.closureRequested ? (
                                                <div className="space-y-3">
                                                    <button type="button" onClick={handleSubmitProgress} disabled={!note.trim() || progressLoading}
                                                        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                                        {progressLoading ? <Loader2 size={16} className="mr-2 inline animate-spin" /> : <Activity size={16} className="mr-2 inline" />}
                                                        {progressLoading ? 'Saving...' : 'Save Progress'}
                                                    </button>
                                                    {!['Super Admin', 'Admin'].includes(user?.role) ? (
                                                        <button type="button" onClick={() => handleAction('request-closure', { actionTaken: note })}
                                                            disabled={actionLoading}
                                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                                                            Request Case Closure
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
        </div>
    );
};

export default IncidentDetail;
