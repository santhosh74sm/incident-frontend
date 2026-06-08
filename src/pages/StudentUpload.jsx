import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
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
} from 'lucide-react';
import apiClient from '../config/apiClient';
import UploadMetricCard from '../components/upload/UploadMetricCard';
import UploadPreviewTable from '../components/upload/UploadPreviewTable';
import UploadStatusBanner from '../components/upload/UploadStatusBanner';
import { useToast } from '../components/ToastProvider';
import { downloadWorkbook } from '../utils/downloadFiles';
import { withFeedback } from '../utils/notifications';
import {
    ACCEPTED_UPLOAD_FORMATS,
    buildPreviewFromFile,
    formatFileSize,
    isSupportedFile,
} from '../utils/uploadHelpers';

const REQUIRED_COLUMNS = ['admissionNo', 'name', 'class', 'section'];

const HEADER_ALIASES = {
    admissionno: 'admissionNo',
    admissionnumber: 'admissionNo',
    name: 'name',
    class: 'class',
    classname: 'class',
    section: 'section',
};

const buildStudentPreview = (file) =>
    buildPreviewFromFile(file, {
        headerAliases: HEADER_ALIASES,
        requiredColumns: REQUIRED_COLUMNS,
        emptyMessage: 'The selected spreadsheet has no rows. Add student data and try again.',
        maxRowIssues: 8,
    });

const downloadStudentTemplate = async (addToast) => {
    const workbook = XLSX.utils.book_new();

    const dataSheet = XLSX.utils.aoa_to_sheet([
        ['admissionNo', 'name', 'class', 'section'],
        ['ADM001', 'Santhosh Kumar', '12', 'A'],
        ['ADM002', 'Ram Prakash', '11', 'B'],
        ['ADM003', 'Meena Devi', '10', 'C'],
    ]);

    dataSheet['!cols'] = [
        { wch: 18 },
        { wch: 26 },
        { wch: 12 },
        { wch: 12 },
    ];

    const instructionSheet = XLSX.utils.aoa_to_sheet([
        ['Student Upload Guide'],
        ['1. Keep the first-row headers unchanged.'],
        ['2. Admission numbers should be unique for each student.'],
        ['3. Use the exact class and section values you want stored.'],
        ['4. Save the file as Excel (.xlsx) before uploading.'],
    ]);

    instructionSheet['!cols'] = [{ wch: 72 }];

    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Students');
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');
    try {
        await withFeedback(
            addToast,
            () => downloadWorkbook(XLSX, workbook, 'student_upload_template.xlsx', {
                title: 'Student upload template',
            }),
            {
                successMessage: 'Sample spreadsheet downloaded.',
                errorMessage: 'Download failed. Please try again.',
            }
        );
    } catch {
        // handled by withFeedback
    }
};

/* ─── Step indicator ──────────────────────────────────────────────── */
const STEPS = [
    { id: 1, label: 'Download sample' },
    { id: 2, label: 'Choose file' },
    { id: 3, label: 'Review preview' },
    { id: 4, label: 'Confirm upload' },
];

const StepBar = ({ activeStep }) => (
    <ol aria-label="Upload steps" className="grid w-full min-w-0 grid-cols-4 items-start gap-1 sm:gap-2">
        {STEPS.map((step, i) => {
            const done    = step.id < activeStep;
            const current = step.id === activeStep;
            return (
                <li key={step.id} className="relative flex min-w-0 flex-col items-center">
                    {i < STEPS.length - 1 && (
                        <div
                            aria-hidden="true"
                            className={`absolute left-1/2 top-3.5 h-0.5 w-full rounded-full transition-colors ${
                                done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                        />
                    )}
                    <span
                        aria-current={current ? 'step' : undefined}
                        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-2 transition-colors ${
                            done
                                ? 'bg-emerald-500 text-white ring-emerald-200'
                                : current
                                ? 'bg-indigo-600 text-white ring-indigo-200'
                                : 'bg-slate-100 text-slate-400 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'
                        }`}
                    >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                    </span>
                    <span
                        className={`mt-2 hidden max-w-full text-center text-[10px] font-semibold uppercase tracking-[0.12em] sm:block ${
                            current ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400'
                        }`}
                    >
                        {step.label}
                    </span>
                </li>
            );
        })}
    </ol>
);

/* ─── Checklist item ──────────────────────────────────────────────── */
const CheckItem = ({ children }) => (
    <li className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
        <span className="text-sm text-slate-700 dark:text-slate-300">{children}</span>
    </li>
);

/* ─── Main component ──────────────────────────────────────────────── */
const StudentUpload = () => {
    const navigate     = useNavigate();
    const fileInputRef = useRef(null);
    const mountedRef   = useRef(true);
    const { addToast } = useToast();

    const [file,           setFile]           = useState(null);
    const [preview,        setPreview]        = useState(null);
    const [uploading,      setUploading]      = useState(false);
    const [parsing,        setParsing]        = useState(false);
    const [message,        setMessage]        = useState({ type: '', text: '' });
    const [dragActive,     setDragActive]     = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [lastUpload,     setLastUpload]     = useState(null);

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

    const resetSelection = () => {
        setFile(null);
        setPreview(null);
        setUploadProgress(0);
        setMessage({ type: '', text: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSelectedFile = async (selectedFile) => {
        if (!selectedFile) return;

        if (!isSupportedFile(selectedFile)) {
            setFile(null);
            setPreview(null);
            setMessage({
                type: 'error',
                text: 'That file type is not supported. Please choose an Excel (.xlsx, .xls) or CSV file.',
            });
            return;
        }

        setFile(selectedFile);
        setUploadProgress(0);
        setMessage({ type: 'info', text: 'Reading your spreadsheet…' });
        setParsing(true);

        try {
            const nextPreview = await buildStudentPreview(selectedFile);
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
                    text: 'Preview loaded. A few rows have incomplete data — review them below before uploading.',
                });
            } else {
                setMessage({
                    type: 'success',
                    text: `Spreadsheet looks good. ${nextPreview.totalRows} student row${nextPreview.totalRows === 1 ? '' : 's'} ready to upload.`,
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

    const handleFileChange = async (e) => { await handleSelectedFile(e.target.files?.[0]); };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) await handleSelectedFile(dropped);
    };

    const handleUpload = async (e) => {
        e.preventDefault();

        if (!file) {
            setMessage({ type: 'error', text: 'Please choose a spreadsheet before uploading.' });
            return;
        }
        if (preview?.missingColumns?.length > 0) {
            setMessage({
                type: 'error',
                text: `Please fix the missing columns before uploading: ${preview.missingColumns.join(', ')}.`,
            });
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setUploadProgress(0);
        setMessage({ type: 'info', text: 'Uploading your spreadsheet…' });

        try {
            const response = await apiClient.post('/api/students/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (pe) => {
                    if (pe.total) setUploadProgress(Math.round((pe.loaded * 100) / pe.total));
                },
            });

            const successText = response.data.message || 'Student records updated successfully.';
            setMessage({ type: 'success', text: successText });
            setLastUpload({ fileName: file.name, totalRows: preview?.totalRows || 0 });
            setUploadProgress(100);
            addToast(successText, 'success');
            resetSelection();
        } catch (error) {
            const errorText =
                error.response?.data?.message ||
                'Upload failed. Please check the spreadsheet format and try again.';
            setMessage({ type: 'error', text: errorText });
        } finally {
            setUploading(false);
        }
    };

    /* Upload-zone label changes based on state */
    const zonePrimary = dragActive
        ? 'Drop your spreadsheet here'
        : parsing
        ? 'Reading your spreadsheet…'
        : file
        ? file.name
        : 'Click to browse, or drag your spreadsheet here';

    const zoneSecondary = file
        ? `${formatFileSize(file.size)} — ${ACCEPTED_UPLOAD_FORMATS}`
        : `Accepted formats: ${ACCEPTED_UPLOAD_FORMATS}`;

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
            <main className="overflow-x-hidden px-3 py-4 sm:p-4 lg:p-6">
                <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">

                    {/* Back button */}
                    <button
                        type="button"
                        onClick={() => navigate('/user-management')}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Back to Management
                    </button>

                    {/* ── Hero header ─────────────────────────────────── */}
                    <section
                        aria-label="Student Upload"
                        className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                    >
                        <div className="bg-[linear-gradient(135deg,#0f172a,#1e1b4b_55%,#312e81)] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0 max-w-2xl">
                                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200">
                                        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                                        Student Data Import
                                    </div>
                                    <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                                        Upload Student Records
                                    </h1>
                                    <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-indigo-100/85">
                                        Add or update student master data by uploading a spreadsheet.
                                        Preview your file before saving — nothing changes until you confirm.
                                    </p>
                                </div>
                                <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
                                    <UploadMetricCard icon={ShieldCheck} label="Required" value="4 columns" tone="indigo" />
                                    <UploadMetricCard icon={Table2}      label="Preview"  value="Up to 5 rows" tone="blue" />
                                    <UploadMetricCard icon={Users}       label="Formats"  value="XLSX / CSV" tone="emerald" />
                                </div>
                            </div>
                        </div>

                        {/* Step bar */}
                        <div className="border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                            <StepBar activeStep={activeStep} />
                        </div>
                    </section>

                    {/* ── Main grid ───────────────────────────────────── */}
                    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">

                        {/* Upload panel */}
                        <section
                            aria-label="Upload workbook"
                            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
                        >
                            {/* Section header */}
                            <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/50 px-4 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div className="min-w-0">
                                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Choose your spreadsheet</h2>
                                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                        Click the area below or drag a file in. Review the preview, then upload.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => downloadStudentTemplate(addToast)}
                                    disabled={uploading || parsing}
                                    className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:w-auto"
                                >
                                    <Download className="h-4 w-4" aria-hidden="true" />
                                    Download sample
                                </button>
                            </div>

                            <div className="space-y-5 p-4 sm:p-6">
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
                                    className={`w-full rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none sm:px-6 sm:py-10 ${
                                        dragActive
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                                            : file && !parsing
                                            ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-500/50 dark:bg-emerald-950/20'
                                            : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-950/20'
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
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                                        {parsing ? (
                                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden="true" />
                                        ) : file ? (
                                            <FileText className="h-8 w-8 text-emerald-600" aria-hidden="true" />
                                        ) : (
                                            <CloudUpload className="h-8 w-8 text-indigo-600" aria-hidden="true" />
                                        )}
                                    </div>

                                    <p className="break-words text-base font-semibold text-slate-900 dark:text-slate-100">
                                        {zonePrimary}
                                    </p>
                                    <p className="mt-1.5 break-words text-sm text-slate-500 dark:text-slate-400">
                                        {zoneSecondary}
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
                                        className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-500/30 dark:bg-blue-950/30"
                                    >
                                        <div className="mb-2.5 flex items-center justify-between text-sm font-semibold text-blue-900 dark:text-blue-100">
                                            <span>
                                                {uploadProgress < 100
                                                    ? 'Uploading your spreadsheet…'
                                                    : 'Saving student records…'}
                                            </span>
                                            <span className="tabular-nums">{uploadProgress}%</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Status message */}
                                <UploadStatusBanner message={message} />

                                {/* Action buttons */}
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading || parsing}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                    >
                                        <FileText className="h-4 w-4" aria-hidden="true" />
                                        Choose File
                                    </button>

                                    <button
                                        type="button"
                                        onClick={resetSelection}
                                        disabled={uploading || parsing || (!file && !preview)}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                    >
                                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                        Reset
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleUpload}
                                        disabled={!canUpload}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    >
                                        {uploading
                                            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                            : <CloudUpload className="h-4 w-4" aria-hidden="true" />}
                                        {uploading
                                            ? (uploadProgress === 100 ? 'Saving records…' : 'Uploading…')
                                            : 'Confirm & Upload'}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Sidebar */}
                        <aside className="min-w-0 space-y-5">

                            {/* Checklist */}
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                                    <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-300">
                                        Before you upload
                                    </h2>
                                </div>
                                <ul className="space-y-3.5 p-5">
                                    <CheckItem>
                                        Keep the column headings exactly as shown in the sample file:
                                        <span className="ml-1 font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                            {REQUIRED_COLUMNS.join(', ')}
                                        </span>
                                    </CheckItem>
                                    <CheckItem>
                                        Each row must represent one student. Admission numbers must be unique.
                                    </CheckItem>
                                    <CheckItem>
                                        Duplicate admission numbers are detected automatically — only new records are added.
                                    </CheckItem>
                                    <CheckItem>
                                        Save the file in Excel format (.xlsx) before uploading.
                                    </CheckItem>
                                </ul>
                            </div>

                            {/* Info tip */}
                            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-500/30 dark:bg-blue-950/30">
                                <div className="flex items-start gap-3">
                                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                    <p className="text-sm text-blue-900 dark:text-blue-200">
                                        Not sure about the format? Download the sample spreadsheet to see an example with the correct column names.
                                    </p>
                                </div>
                            </div>

                            {/* Last upload summary */}
                            {lastUpload && (
                                <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20">
                                    <div className="border-b border-emerald-100 px-5 py-3.5 dark:border-emerald-500/20">
                                        <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-100">
                                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                            Last upload completed
                                        </h2>
                                    </div>
                                    <div className="space-y-1.5 px-5 py-4 text-sm text-emerald-800 dark:text-emerald-200">
                                        <p className="break-all"><strong>File:</strong> {lastUpload.fileName}</p>
                                        <p><strong>Rows in file:</strong> {lastUpload.totalRows || 'N/A'}</p>
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>

                    {/* Preview table */}
                    <UploadPreviewTable preview={preview} />

                </div>
            </main>
        </div>
    );
};

export default StudentUpload;
