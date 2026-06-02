import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    CloudUpload,
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
    RefreshCw,
    ShieldCheck,
    Table2,
} from 'lucide-react';
import apiClient from '../config/apiClient';
import UploadMetricCard from '../components/upload/UploadMetricCard';
import UploadPreviewTable from '../components/upload/UploadPreviewTable';
import UploadStatusBanner from '../components/upload/UploadStatusBanner';
import { useToast } from '../components/ToastProvider';
import { downloadWorkbook } from '../utils/downloadFiles';
import { getErrorMessage, showError, showSuccess } from '../utils/notifications';
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
        emptyMessage: 'The selected workbook is empty. Add student rows and try again.',
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
        await downloadWorkbook(XLSX, workbook, 'student_upload_template.xlsx', {
            title: 'Student upload template',
        });
        showSuccess(addToast, 'Template downloaded successfully.');
    } catch (error) {
        showError(addToast, getErrorMessage(error, 'Download failed.'));
    }
};

const StudentUpload = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const mountedRef = useRef(true);
    const { addToast } = useToast();

    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [dragActive, setDragActive] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [lastUpload, setLastUpload] = useState(null);

    const canUpload = useMemo(
        () => Boolean(file) && !uploading && !parsing && !(preview?.missingColumns?.length > 0),
        [file, parsing, preview?.missingColumns, uploading]
    );

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

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
                text: 'Please upload a workbook in .xlsx, .xls, or .csv format.',
            });
            return;
        }

        setFile(selectedFile);
        setUploadProgress(0);
        setMessage({ type: '', text: '' });
        setParsing(true);

        try {
            const nextPreview = await buildStudentPreview(selectedFile);
            if (!mountedRef.current) return;
            setPreview(nextPreview);

            if (nextPreview.missingColumns.length > 0) {
                setMessage({
                    type: 'error',
                    text: `The file columns do not match the sample. Missing: ${nextPreview.missingColumns.join(', ')}.`,
                });
            } else if (nextPreview.rowIssues.length > 0) {
                setMessage({
                    type: 'warning',
                    text: 'Preview loaded with a few incomplete rows. Review the highlighted rows before uploading.',
                });
            } else {
                setMessage({
                    type: 'info',
                    text: `Preview ready. ${nextPreview.totalRows} row${nextPreview.totalRows === 1 ? '' : 's'} detected.`,
                });
            }
        } catch (error) {
            if (!mountedRef.current) return;
            setPreview(null);
            setMessage({
                type: 'error',
                text: error.message || 'We could not read this workbook. Please verify the file and try again.',
            });
        } finally {
            if (mountedRef.current) {
                setParsing(false);
            }
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
            setMessage({ type: 'error', text: 'Choose a workbook before starting the upload.' });
            return;
        }

        if (preview?.missingColumns?.length > 0) {
            setMessage({
                type: 'error',
                text: `The workbook cannot be uploaded until these columns are fixed: ${preview.missingColumns.join(', ')}.`,
            });
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setUploadProgress(0);
        setMessage({ type: '', text: '' });

        try {
            const response = await apiClient.post('/api/students/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    },
                onUploadProgress: (progressEvent) => {
                    if (!progressEvent.total) return;
                    setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                },
            });

            const successMessage = response.data.message || 'Student records updated successfully.';
            setMessage({ type: 'success', text: successMessage });
            setLastUpload({
                fileName: file.name,
                totalRows: preview?.totalRows || 0,
            });
            setUploadProgress(100);
            addToast(successMessage, 'success');
            resetSelection();
        } catch (error) {
            const errorText =
                error.response?.data?.message ||
                'Upload failed. Please confirm the workbook format and try again.';

            setMessage({ type: 'error', text: errorText });
        } finally {
            setUploading(false);
        }
    };

    return (
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
                                        <h1 className="text-2xl font-bold text-white">Student Upload Suite</h1>
                                        <p className="mt-2 text-sm text-slate-200">
                                            Upload student master data with a cleaner preview step, clearer validation, and safer final confirmation.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <UploadMetricCard icon={ShieldCheck} label="Required Fields" value="4 columns" tone="indigo" />
                                        <UploadMetricCard icon={Table2} label="Preview" value="First 5 rows" tone="blue" />
                                        <UploadMetricCard icon={CloudUpload} label="Accepted Files" value="XLSX, XLS, CSV" tone="emerald" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
                            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900/50">
                                <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Upload Workbook</h2>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Click or drag a workbook here, review the preview, then commit the update.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => downloadStudentTemplate(addToast)}
                                        disabled={uploading || parsing}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Download className="h-4 w-4" />
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
                                                {dragActive ? 'Drop your workbook to preview it' : 'Click to browse or drag your workbook here'}
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
                                                <span>Uploading student workbook</span>
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
                                    <h2 className="text-lg font-semibold text-slate-900">Workbook Checklist</h2>
                                    <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                                            Keep these exact headers: <strong>{REQUIRED_COLUMNS.join(', ')}</strong>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                                            One row should represent one student record.
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70">
                                            Upload checks for duplicate Admission Numbers and ensures only new, unique records are inserted.
                                        </div>
                                    </div>
                                </div>

                                {lastUpload && (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-md">
                                        <h2 className="text-lg font-semibold text-emerald-900">Latest Completed Upload</h2>
                                        <div className="mt-4 space-y-2 text-sm text-emerald-900">
                                            <p>
                                                <strong>File:</strong> {lastUpload.fileName}
                                            </p>
                                            <p>
                                                <strong>Rows previewed:</strong> {lastUpload.totalRows || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>

                        <UploadPreviewTable preview={preview} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default StudentUpload;
