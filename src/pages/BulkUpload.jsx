import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    CloudUpload,
    Download,
    FileSpreadsheet,
    FileText,
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
import { getErrorMessage, showError, showSuccess } from '../utils/notifications';
import {
    ACCEPTED_UPLOAD_FORMATS,
    buildPreviewFromFile,
    formatFileSize,
    isSupportedFile,
} from '../utils/uploadHelpers';

const REQUIRED_COLUMNS = ['admissionNumber', 'category', 'location', 'description', 'evidenceType', 'day', 'month', 'year', 'hour', 'minute'];

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
        messages.push('timePeriod should be AM or PM');
    }

    const highPriority = String(row.highPriority ?? '').trim().toLowerCase();
    if (highPriority && !['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(highPriority)) {
        messages.push('highPriority should be Yes or No');
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
        <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
            <div className="my-auto max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 px-6 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Upload Review</h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Here is what the school server found in each row of your file.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-5 overflow-y-auto p-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <UploadMetricCard icon={CheckCircle2} label="Successful Rows" value={results.successRows || 0} tone="emerald" />
                        <UploadMetricCard icon={AlertTriangle} label="Failed Rows" value={results.failedRows || 0} tone="blue" />
                        <UploadMetricCard icon={Table2} label="Total Rows" value={results.totalRows || 0} tone="indigo" />
                    </div>

                    {results.errors?.length > 0 ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-950/30">
                            <div className="border-b border-red-100 px-4 py-3 flex justify-between items-center dark:border-red-500/30">
                                <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">Rows that need correction</h4>
                                {results.errors.length > 50 && (
                                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">Showing first 50</span>
                                )}
                            </div>
                            <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
                                {results.errors.slice(0, 50).map((error, index) => (
                                    <div key={`server-error-${index}`} className="rounded-lg border border-red-100 bg-white px-4 py-3 dark:border-red-500/20 dark:bg-slate-900">
                                        <p className="text-sm font-semibold text-red-900 dark:text-red-100">
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
                            All rows passed the school server checks.
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/60 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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

const BulkUpload = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const { addToast } = useToast();

    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [downloadingTemplate, setDownloadingTemplate] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [results, setResults] = useState(null);
    const [showResults, setShowResults] = useState(false);

    const canUpload = useMemo(
        () => Boolean(file) && !uploading && !parsing && !(preview?.missingColumns?.length > 0),
        [file, parsing, preview?.missingColumns, uploading]
    );

    const resetSelection = () => {
        setFile(null);
        setPreview(null);
        setUploadProgress(0);
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
            setPreview(nextPreview);

            if (nextPreview.missingColumns.length > 0) {
                setMessage({
                    type: 'error',
                    text: `The file columns do not match the sample. Missing: ${nextPreview.missingColumns.join(', ')}.`,
                });
            } else if (nextPreview.rowIssues.length > 0) {
                setMessage({
                    type: 'warning',
                    text: 'Preview loaded with row issues. Please fix them before you upload.',
                });
            } else {
                setMessage({
                    type: 'info',
                    text: `Preview ready. ${nextPreview.totalRows} incident row${nextPreview.totalRows === 1 ? '' : 's'} detected.`,
                });
            }
        } catch (error) {
            setPreview(null);
            setMessage({
                type: 'error',
                text: error.message || 'We could not read this file. Please check the format and try again.',
            });
        } finally {
            setParsing(false);
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

    const handleUpload = async (event) => {
        event.preventDefault();

        if (!file) {
            setMessage({ type: 'error', text: 'Choose a file before starting the upload.' });
            return;
        }

        if (preview?.missingColumns?.length > 0) {
            setMessage({
                type: 'error',
                text: `This file cannot be uploaded until these columns are fixed: ${preview.missingColumns.join(', ')}.`,
            });
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setUploadProgress(0);
        setMessage({ type: '', text: '' });

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

            const validationResults = response.data.validationResults || null;
            const successMessage = response.data.message || 'Incident upload completed successfully.';

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
                throw new Error('The school server returned an empty sample file.');
            }

            await downloadBlob(blob, 'incident_upload_template.xlsx', {
                title: 'Incident upload template',
            });

            showSuccess(addToast, 'Template downloaded successfully.');
        } catch (error) {
            showError(addToast, getErrorMessage(error, 'Download failed.'));
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
            <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
                <div className="flex min-w-0 flex-1 flex-col">

                    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                        <div className="mx-auto max-w-6xl space-y-6">
                            <button
                                onClick={() => navigate('/user-management')}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Management
                            </button>

                            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-6 py-7 lg:px-8">
                                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                                        <div className="max-w-2xl">
                                            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                                                <FileSpreadsheet className="h-6 w-6 text-white" />
                                            </div>
                                            <h1 className="text-2xl font-bold text-white">Add many incidents from a spreadsheet</h1>
                                            <p className="mt-2 text-sm text-slate-200">
                                                Review the spreadsheet before you upload. The on-screen preview checks column names only; the school server still checks categories, locations, evidence types, staff, and students when you save.
                                            </p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <UploadMetricCard icon={ShieldCheck} label="Required Fields" value="10 columns" tone="indigo" />
                                            <UploadMetricCard icon={Users} label="Full checks" value="On save" tone="blue" />
                                            <UploadMetricCard icon={CloudUpload} label="Preview" value="First 5 rows" tone="emerald" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
                                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                                    <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900">Upload spreadsheet</h2>
                                            <p className="mt-1 text-sm text-slate-600">
                                                Click or drag your file here, review the preview, then save to add the incidents.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={downloadTemplate}
                                            disabled={uploading || parsing || downloadingTemplate}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {downloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            Download sample spreadsheet
                                        </button>
                                    </div>

                                    <div className="space-y-5 p-5">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragEnter={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDragOver={handleDrag}
                                            onDrop={handleDrop}
                                            className={`w-full rounded-xl border-2 border-dashed px-6 py-10 text-left transition ${
                                                dragActive
                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                                                    : file
                                                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/30'
                                                    : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-950/30'
                                            }`}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />

                                            <div className="flex flex-col items-center justify-center text-center">
                                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                                                    {parsing ? (
                                                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                                    ) : file ? (
                                                        <FileText className="h-8 w-8 text-emerald-600" />
                                                    ) : (
                                                        <CloudUpload className="h-8 w-8 text-indigo-600" />
                                                    )}
                                                </div>

                                                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                                    {dragActive ? 'Drop your file to preview it' : 'Click to browse or drag your spreadsheet here'}
                                                </p>
                                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                                    Supported upload formats: <span className="font-semibold text-indigo-700">{ACCEPTED_UPLOAD_FORMATS}</span>
                                                </p>

                                                {file && (
                                                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                                                        <FileText className="h-4 w-4 text-emerald-600" />
                                                        {file.name}
                                                        <span className="text-slate-400">•</span>
                                                        {formatFileSize(file.size)}
                                                    </div>
                                                )}
                                            </div>
                                        </button>

                                        {uploading && (
                                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/30 dark:bg-blue-950/30">
                                                <div className="mb-2 flex items-center justify-between text-sm font-semibold text-blue-900 dark:text-blue-100">
                                                    <span>Uploading incidents from your file</span>
                                                    <span>{uploadProgress}%</span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <UploadStatusBanner message={message} />

                                        <div className="grid gap-3 md:grid-cols-3">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploading || parsing}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                <FileText className="h-4 w-4" />
                                                Choose File
                                            </button>

                                            <button
                                                type="button"
                                                onClick={resetSelection}
                                                disabled={uploading || parsing || (!file && !preview)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Reset
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleUpload}
                                                disabled={!canUpload}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                                            >
                                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                                                {uploading ? (uploadProgress === 100 ? `Saving ${preview?.totalRows || ''} records...` : 'Uploading...') : 'Confirm & Upload'}
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                                        <h2 className="text-lg font-semibold text-slate-900">Checklist before upload</h2>
                                        <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                                                Required column headings: <strong>{REQUIRED_COLUMNS.join(', ')}</strong>
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                                                The on-screen preview checks column names only. When you upload, the school server checks categories, locations, evidence types, staff, and students.
                                            </div>
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                                                Download the sample spreadsheet so your column names match what the school expects.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-md dark:border-blue-500/30 dark:bg-blue-950/30">
                                        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Optional Columns</h2>
                                        <div className="mt-4 grid gap-3 text-sm text-blue-900 dark:text-blue-100">
                                            <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 dark:border-blue-500/20 dark:bg-slate-900">
                                                <strong>handledBy</strong> should contain a valid staff email.
                                            </div>
                                            <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 dark:border-blue-500/20 dark:bg-slate-900">
                                                <strong>timePeriod</strong> accepts AM or PM.
                                            </div>
                                            <div className="rounded-xl border border-blue-100 bg-white px-4 py-3 dark:border-blue-500/20 dark:bg-slate-900">
                                                <strong>highPriority</strong> accepts Yes or No.
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <UploadPreviewTable preview={preview} />
                        </div>
                    </main>
                </div>
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
