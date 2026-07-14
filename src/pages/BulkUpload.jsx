import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    CloudUpload,
    Download,
    FileSpreadsheet,
    FileText,
    Info,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Table2,
    Users,
    X,
} from 'lucide-react';
import apiClient from '../config/apiClient';
import UploadMetricCard from '../components/upload/UploadMetricCard';
import UploadPreviewTable from '../components/upload/UploadPreviewTable';
import UploadStatusBanner from '../components/upload/UploadStatusBanner';
import { useToast } from '../components/ToastProvider';
import { downloadBlob } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';
import { focusAndScrollField } from '../hooks/useFocusFirstInvalid';
import {
    ACCEPTED_UPLOAD_FORMATS,
    buildPreviewFromFile,
    formatFileSize,
    isSupportedFile,
} from '../utils/uploadHelpers';

const REQUIRED_COLUMNS = ['admissionNumber', 'category', 'day', 'month', 'year', 'hour', 'minute'];
const JOB_POLL_INTERVAL_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const HEADER_ALIASES = {
    admissionnumber: 'admissionNumber',
    category: 'category',
    location: 'location',
    description: 'description',
    evidencetype: 'evidenceType',
    evidence: 'evidenceType',
    handledby: 'handledBy',
    handledbystaffemail: 'handledBy',
    assignee: 'handledBy',
    assignedby: 'handledBy',
    day: 'day',
    month: 'month',
    year: 'year',
    hour: 'hour',
    minute: 'minute',
    timeperiod: 'timePeriod',
    timeperiodampm: 'timePeriod',
    highpriority: 'highPriority',
    highpriorityyesno: 'highPriority',
};

const validateIncidentRow = (row) => {
    const messages = [];
    const timePeriod = String(row.timePeriod ?? '').trim().toUpperCase();
    if (timePeriod && !['AM', 'PM', 'A', 'P'].includes(timePeriod)) {
        messages.push('Time period must be AM or PM.');
    }

    const highPriority = String(row.highPriority ?? '').trim().toLowerCase();
    if (highPriority && !['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(highPriority)) {
        messages.push('High priority must be Yes or No.');
    }

    return messages;
};

const buildIncidentPreview = (file) =>
    buildPreviewFromFile(file, {
        headerAliases: HEADER_ALIASES,
        requiredColumns: REQUIRED_COLUMNS,
        emptyMessage: 'The selected file has no data rows. Add incident rows and try again.',
        validateRow: validateIncidentRow,
        maxRowIssues: 10,
    });

const UploadResultsModal = ({ results, onClose, onReset }) => {
    if (!results) return null;

    return (
        <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-end justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="my-auto max-h-[min(92vh,calc(100dvh-1.5rem))] w-full max-w-3xl min-w-0 overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl sm:rounded-xl">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-900 ">Upload Review</h3>
                        <p className="mt-1 text-sm text-slate-600 ">Here is what the system found in each row of your file.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-5 overflow-y-auto p-4 sm:p-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <UploadMetricCard icon={CheckCircle2} label="Successful Rows" value={results.successRows || 0} tone="emerald" />
                        <UploadMetricCard icon={AlertTriangle} label="Failed Rows" value={results.failedRows || 0} tone="blue" />
                        <UploadMetricCard icon={Table2} label="Total Rows" value={results.totalRows || 0} tone="indigo" />
                    </div>

                    {results.errors?.length > 0 ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 ">
                            <div className="border-b border-red-100 px-4 py-3 flex justify-between items-center ">
                                <h4 className="text-sm font-semibold text-red-900 ">Rows That Need Correction</h4>
                                {results.errors.length > 50 && (
                                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">Showing first 50</span>
                                )}
                            </div>
                            <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
                                {results.errors.slice(0, 50).map((error, index) => (
                                    <div key={`server-error-${index}`} className="rounded-lg border border-red-100 bg-white px-4 py-3 ">
                                        <p className="text-sm font-semibold text-red-900 ">
                                            Row {error.row}: {error.reason}
                                        </p>
                                        {error.column && (
                                            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-red-600">
                                                Column: {error.column}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                            All rows passed validation.
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 "
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        Upload Another File
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Step indicator (matches StudentUpload) ─────────────────────── */
const STEPS = [
    { id: 1, label: 'Download Sample' },
    { id: 2, label: 'Choose File' },
    { id: 3, label: 'Review Preview' },
    { id: 4, label: 'Confirm Upload' },
];

const StepBar = ({ activeStep }) => (
    <ol aria-label="Upload steps" className="grid w-full min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {STEPS.map((step, i) => {
            const done    = step.id < activeStep;
            const current = step.id === activeStep;
            return (
                <li key={step.id} className="relative flex min-w-0 flex-col items-center">
                    {i < STEPS.length - 1 && (
                        <div
                            aria-hidden="true"
                            className={`absolute inset-x-0 top-3.5 h-0.5 rounded-full transition-colors ${
                                done ? 'bg-emerald-400' : 'bg-slate-200 '
                            }`}
                        />
                    )}
                    <span
                        aria-current={current ? 'step' : undefined}
                        className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ring-2 transition-colors ${
                            done
                                ? 'bg-emerald-500 text-white ring-emerald-200'
                                : current
                                ? 'bg-indigo-600 text-white ring-indigo-200'
                                : 'bg-slate-100 text-slate-400 ring-slate-200 '
                        }`}
                    >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                    </span>
                    <span
                        className={`mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            current ? 'text-indigo-700 ' : 'text-slate-500 '
                        }`}
                    >
                        {step.label}
                    </span>
                </li>
            );
        })}
    </ol>
);

/* ─── Checklist item (matches StudentUpload) ─────────────────────── */
const CheckItem = ({ children }) => (
    <li className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
        <span className="text-sm text-slate-700 ">{children}</span>
    </li>
);

const BulkUpload = () => {
    const fileInputRef = useRef(null);
    const uploadTriggerRef = useRef(null);
    const mountedRef   = useRef(true);
    const { addToast } = useToast();

    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadStage, setUploadStage] = useState('');
    const [results, setResults] = useState(null);
    const [showResults, setShowResults] = useState(false);
    const [academicYears, setAcademicYears] = useState([]);
    const [academicYear, setAcademicYear] = useState('');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('');

    /* Derive the active step for the step bar */
    const activeStep = useMemo(() => {
        if (message.type === 'success' && !file) return 4;
        if (uploading || uploadProgress === 100) return 4;
        if (preview && !preview.missingColumns?.length) return 3;
        if (file) return 2;
        return 1;
    }, [file, message.type, preview, uploading, uploadProgress]);

    const canUpload = useMemo(
        () => Boolean(file) && !uploading && !parsing && !(preview?.missingColumns?.length > 0),
        [file, parsing, preview?.missingColumns, uploading]
    );

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        let mounted = true;
        apiClient.get('/api/auth/academic-years')
            .then(({ data }) => {
                if (!mounted) return;
                const years = Array.isArray(data?.academicYears) ? data.academicYears : [];
                setAcademicYears(years);
                const currentYear = data?.currentAcademicYear || years[years.length - 1] || '';
                setCurrentAcademicYear(currentYear);
                setAcademicYear(currentYear);
            })
            .catch(() => {
                if (mounted) {
                    setAcademicYears([]);
                    setCurrentAcademicYear('');
                }
            });
        return () => { mounted = false; };
    }, []);

    const resetSelection = () => {
        setFile(null);
        setPreview(null);
        setUploadProgress(0);
        setUploadStage('');
        setMessage({ type: '', text: '' });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSelectedFile = async (selectedFile) => {
        if (!selectedFile) return;

        if (!isSupportedFile(selectedFile)) {
            setFile(null);
            setPreview(null);
            setMessage({
                type: 'error',
                text: 'Please upload a spreadsheet in .xlsx, .xls, or .csv format.',
            });
            return;
        }

        setFile(selectedFile);
        setUploadProgress(0);
        setMessage({ type: '', text: '' });
        setParsing(true);

        try {
            const nextPreview = await buildIncidentPreview(selectedFile);
            if (!mountedRef.current) return;
            setPreview(nextPreview);

            if (nextPreview.missingColumns.length > 0) {
                setMessage({
                    type: 'error',
                    text: `Some required columns are missing: ${nextPreview.missingColumns.join(', ')}. Please check the spreadsheet format.`,
                });
            } else if (nextPreview.rowIssues.length > 0) {
                setMessage({
                    type: 'warning',
                    text: 'Preview loaded. A few rows have issues — review them below before uploading.',
                });
            } else {
                setMessage({
                    type: 'success',
                    text: `Spreadsheet looks good. ${nextPreview.totalRows} incident row${nextPreview.totalRows === 1 ? '' : 's'} ready to upload.`,
                });
            }
        } catch (error) {
            if (!mountedRef.current) return;
            setPreview(null);
            setMessage({
                type: 'error',
                text: error.message || 'We could not read this file. Please check the format and try again.',
            });
        } finally {
            if (mountedRef.current) setParsing(false);
        }
    };

    const handleFileChange = async (event) => {
        await handleSelectedFile(event.target.files?.[0]);
    };

    const handleDrag = (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (event.type === 'dragenter' || event.type === 'dragover') {
            setDragActive(true);
        } else if (event.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragActive(false);

        const droppedFile = event.dataTransfer.files?.[0];
        if (droppedFile) {
            await handleSelectedFile(droppedFile);
        }
    };

    const pollBulkUploadJob = async (jobId) => {
        while (mountedRef.current) {
            await sleep(JOB_POLL_INTERVAL_MS);
            const response = await apiClient.get(`/api/incidents/upload/${jobId}`);
            const job = response.data;
            const progress = job.progress || {};

            if (progress.stage) setUploadStage(progress.stage);
            if (Number.isFinite(progress.percent)) setUploadProgress(progress.percent);

            if (job.status === 'completed') return job.result || {};
            if (job.status === 'failed') {
                const error = new Error(job.error?.message || 'Upload failed. Please confirm the workbook format and try again.');
                error.response = { data: job.error || {} };
                throw error;
            }
        }

        throw new Error('Upload status polling stopped before the job completed.');
    };

    const handleUpload = async (event) => {
        event.preventDefault();

        if (!file) {
            setMessage({ type: 'error', text: 'Choose a file before starting the upload.' });
            focusAndScrollField(uploadTriggerRef.current);
            return;
        }

        if (preview?.missingColumns?.length > 0) {
            setMessage({
                type: 'error',
                text: `This file cannot be uploaded until these columns are fixed: ${preview.missingColumns.join(', ')}.`,
            });
            focusAndScrollField(uploadTriggerRef.current);
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        if (academicYear) formData.append('academicYear', academicYear);

        setUploading(true);
        setUploadProgress(0);
        setUploadStage('Uploading spreadsheet');
        setMessage({ type: 'info', text: 'Uploading your spreadsheet…' });

        try {
            const response = await apiClient.post('/api/incidents/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    },
                onUploadProgress: (progressEvent) => {
                    if (!progressEvent.total) return;
                    setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                },
            });

            let uploadResult = response.data;
            if (response.status === 202 && response.data?.jobId) {
                setUploadStage(response.data.progress?.stage || 'Processing spreadsheet');
                setUploadProgress(response.data.progress?.percent || 1);
                setMessage({ type: 'info', text: response.data.message || 'Processing your spreadsheet...' });
                uploadResult = await pollBulkUploadJob(response.data.jobId);
            }

            const validationResults = uploadResult.validationResults || null;
            const successMessage = uploadResult.message || 'Incident upload completed successfully.';

            if (validationResults) {
                setResults(validationResults);
                setShowResults(true);
                if ((validationResults.failedRows || 0) > 0) {
                    setMessage({
                        type: 'warning',
                        text: `${validationResults.successRows || 0} rows uploaded, ${validationResults.failedRows || 0} rows need correction.`,
                    });
                    addToast('Incident upload completed with a few validation issues.', 'warning');
                } else {
                    setMessage({ type: 'success', text: successMessage });
                    addToast(successMessage, 'success');
                }
            } else {
                setMessage({ type: 'success', text: successMessage });
                addToast(successMessage, 'success');
            }

            setUploadProgress(100);
            setUploadStage('Completed');
            resetSelection();
        } catch (error) {
            const errorData = error.response?.data;
            const errorText =
                errorData?.message ||
                'Upload failed. Please confirm the workbook format and try again.';

            if (errorData?.validationResults) {
                setResults(errorData.validationResults);
                setShowResults(true);
            }

            setUploadStage('Failed');
            setMessage({ type: 'error', text: errorText });
        } finally {
            setUploading(false);
        }
    };

    const downloadTemplate = async () => {
        setDownloadingTemplate(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await apiClient.get('/api/incidents/template', {
                params: { format: 'xlsx' },
                headers: {},
                responseType: 'blob',
            });

            const blob = response.data;
            if (!blob || blob.size === 0) {
                throw new Error('The system returned an empty sample file.');
            }

            await withFeedback(
                addToast,
                () => downloadBlob(blob, 'incident_upload_template.xlsx', {
                    title: 'Incident Upload Template',
                }),
                {
                    successMessage: 'Template downloaded successfully.',
                    errorMessage: 'Download failed.',
                }
            );
        } catch (error) {
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Could not download the sample file. Please try again.',
            });
        } finally {
            setDownloadingTemplate(false);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-[#f6f8fc]">
                    <main className="overflow-x-hidden px-3 py-4 sm:p-4 lg:p-6">
                        <div className="mx-auto w-full max-w-[1560px] min-w-0 space-y-5">
                            {/* ── Hero header ─────────────────────────────────── */}
                            <section
                                aria-label="Incident Upload"
                                className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                            >
                                <div className="px-5 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0 max-w-2xl">
                                            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700">
                                                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                                                Incident Data Import
                                            </div>
                                            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-[28px]">
                                                Upload Incident Records
                                            </h1>
                                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                                Upload incident records with guided validation and review before you confirm.
                                            </p>
                                        </div>
                                        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <UploadMetricCard icon={Table2} label="Incident Rows" value={preview?.totalRows ?? '—'} tone="indigo" variant="surface" helper="In current file" />
                                            <UploadMetricCard icon={ShieldCheck} label="Columns Required" value={REQUIRED_COLUMNS.length} tone="blue" variant="surface" helper="Required columns" />
                                            <UploadMetricCard icon={FileText} label="Allowed Formats" value="XLSX / CSV" tone="emerald" variant="surface" helper="File formats" />
                                            <UploadMetricCard icon={Users} label="Academic Year" value={academicYear || '—'} tone="indigo" variant="surface" helper="Upload destination" />
                                        </div>
                                    </div>
                                </div>

                                {/* Step bar */}
                                <div className="border-t border-slate-200 bg-slate-50 px-5 py-5 sm:px-6 sm:py-6">
                                    <StepBar activeStep={activeStep} />
                                </div>
                            </section>

                            {/* ── Main grid ───────────────────────────────────── */}
                            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">

                                {/* Upload panel */}
                                <section
                                    aria-label="Upload workbook"
                                    className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                                >
                                    {/* Section header */}
                                    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
                                        <div className="min-w-0">
                                            <h2 className="text-base font-bold tracking-tight text-slate-950">Choose Your Spreadsheet</h2>
                                            <p className="mt-1.5 text-sm leading-6 text-slate-500">
                                                Click the area below or drag a file in. Review the preview, then upload.
                                            </p>
                                        </div>
                                        <button
                                            ref={uploadTriggerRef}
                                            type="button"
                                            onClick={downloadTemplate}
                                            disabled={uploading || parsing || downloadingTemplate}
                                            className="btn-primary w-full shrink-0 sm:w-auto"
                                        >
                                            {downloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                                            Download Sample
                                        </button>
                                    </div>

                                    <div className="space-y-5 p-5 sm:p-6">
                                        {/* Drop zone */}
                                        <button
                                            type="button"
                                            aria-label="Select spreadsheet file"
                                            onClick={() => !parsing && !uploading && fileInputRef.current?.click()}
                                            onDragEnter={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDragOver={handleDrag}
                                            onDrop={handleDrop}
                                            disabled={parsing || uploading}
                                            className={`w-full rounded-lg border-2 border-dashed px-5 py-10 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none sm:px-6 sm:py-12 ${
                                                dragActive
                                                    ? 'border-indigo-500 bg-indigo-50 '
                                                    : file && !parsing
                                                    ? 'border-emerald-400 bg-emerald-50/60 '
                                                    : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50 '
                                            }`}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={handleFileChange}
                                                className="hidden"
                                                aria-hidden="true"
                                            />

                                            {/* Icon */}
                                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
                                                {parsing ? (
                                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden="true" />
                                                ) : file ? (
                                                    <FileText className="h-8 w-8 text-emerald-600" aria-hidden="true" />
                                                ) : (
                                                    <CloudUpload className="h-8 w-8 text-indigo-600" aria-hidden="true" />
                                                )}
                                            </div>

                                            <p className="break-words text-lg font-semibold text-slate-900">
                                                {dragActive
                                                    ? 'Drop your spreadsheet here'
                                                    : parsing
                                                    ? 'Reading your spreadsheet…'
                                                    : file
                                                    ? file.name
                                                    : 'Click to browse, or drag your spreadsheet here'}
                                            </p>
                                            <p className="mt-2 break-words text-sm leading-6 text-slate-500">
                                                {file
                                                    ? `${formatFileSize(file.size)} — ${ACCEPTED_UPLOAD_FORMATS}`
                                                    : `Accepted formats: ${ACCEPTED_UPLOAD_FORMATS}`}
                                            </p>
                                        </button>

                                        {/* Upload progress */}
                                        {uploading && (
                                            <div
                                                role="progressbar"
                                                aria-valuenow={uploadProgress}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-label="Upload progress"
                                                className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4"
                                            >
                                                <div className="mb-3 flex items-center justify-between text-sm font-semibold text-blue-900">
                                                    <span>
                                                        {uploadStage ? uploadStage : uploadProgress < 100
                                                            ? 'Uploading your spreadsheet…'
                                                            : 'Saving incident records…'}
                                                    </span>
                                                    <span className="tabular-nums">{uploadProgress}%</span>
                                                </div>
                                                <div className="h-2.5 overflow-hidden rounded-full bg-blue-100">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <UploadStatusBanner message={message} />

                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                                            Current Academic Year: {currentAcademicYear || 'Loading…'}
                                        </div>

                                        <label className="block">
                                            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                Academic Year
                                            </span>
                                            <select
                                                value={academicYear}
                                                onChange={(event) => setAcademicYear(event.target.value)}
                                                className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                                            >
                                                {academicYears.map((year) => (
                                                    <option key={year} value={year}>{year}</option>
                                                ))}
                                            </select>
                                        </label>

                                        {/* Action buttons */}
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploading || parsing}
                                                className="btn-secondary w-full"
                                            >
                                                <FileText className="h-4 w-4" aria-hidden="true" />
                                                Choose File
                                            </button>

                                            <button
                                                type="button"
                                                onClick={resetSelection}
                                                disabled={uploading || parsing || (!file && !preview)}
                                                className="btn-secondary w-full"
                                            >
                                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                                Reset
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleUpload}
                                                disabled={!canUpload}
                                                className="btn-primary w-full"
                                            >
                                                {uploading
                                                    ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                                    : <CloudUpload className="h-4 w-4" aria-hidden="true" />}
                                                {uploading
                                                    ? (uploadProgress === 100 ? 'Saving records…' : 'Uploading…')
                                                    : 'Confirm Upload'}
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                {/* Sidebar */}
                                <aside className="min-w-0 space-y-5">

                                    {/* Checklist */}
                                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                                        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                                            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                                                Before You Upload
                                            </h2>
                                        </div>
                                        <ul className="space-y-3.5 p-5">
                                            <CheckItem>
                                                Keep the column headings exactly as shown in the sample file:
                                                <span className="ml-1 font-mono text-xs font-semibold text-indigo-700 ">
                                                    {REQUIRED_COLUMNS.join(', ')}
                                                </span>
                                            </CheckItem>
                                            <CheckItem>
                                                Each row must represent one incident. Date and time columns must be filled in.
                                            </CheckItem>
                                            <CheckItem>
                                                The preview checks column names only. When you confirm, the system also checks category, student, and any optional location or evidence type values you include.
                                            </CheckItem>
                                            <CheckItem>
                                                Save the file in Excel format (.xlsx) before uploading.
                                            </CheckItem>
                                        </ul>
                                    </div>

                                    {/* Optional columns info */}
                                    <div className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50 shadow-sm">
                                        <div className="border-b border-blue-100 px-5 py-4">
                                            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-blue-800">
                                                <Info className="h-4 w-4" aria-hidden="true" />
                                                Optional Columns
                                            </h2>
                                        </div>
                                        <ul className="space-y-3.5 p-5">
                                            <li className="text-sm text-blue-900 ">
                                                <span className="font-mono font-semibold">location</span> — optional; if used, it must match an existing location.
                                            </li>
                                            <li className="text-sm text-blue-900 ">
                                                <span className="font-mono font-semibold">description</span> — optional incident notes.
                                            </li>
                                            <li className="text-sm text-blue-900 ">
                                                <span className="font-mono font-semibold">evidenceType</span> — optional; comma-separate multiple existing evidence types.
                                            </li>
                                            <li className="text-sm text-blue-900 ">
                                                <span className="font-mono font-semibold">handledBy</span> — a valid staff email address.
                                            </li>
                                            <li className="text-sm text-blue-900 ">
                                                <span className="font-mono font-semibold">timePeriod</span> — enter <strong>AM</strong> or <strong>PM</strong>.
                                            </li>
                                            <li className="text-sm text-blue-900 ">
                                                <span className="font-mono font-semibold">highPriority</span> — enter <strong>Yes</strong> or <strong>No</strong>.
                                            </li>
                                        </ul>
                                    </div>

                                    {/* Info tip */}
                                    <div className="overflow-hidden rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 shadow-sm">
                                        <div className="flex items-start gap-3">
                                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 " aria-hidden="true" />
                                            <p className="text-sm text-blue-900 ">
                                                Not sure about the format? Download the sample spreadsheet to see an example with the correct column names.
                                            </p>
                                        </div>
                                    </div>

                                </aside>
                            </div>

                            <UploadPreviewTable preview={preview} />
                        </div>
                    </main>
            </div>

            <UploadResultsModal
                results={showResults ? results : null}
                onClose={() => setShowResults(false)}
                onReset={() => {
                    setShowResults(false);
                    resetSelection();
                }}
            />
        </>
    );
};

export default BulkUpload;
