import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import apiClient from '../config/apiClient';

const labelMap = {
    students: 'Students',
    incidents: 'Incidents',
    'issued-letters': 'Issued Letters',
};

const summaryLabelMap = {
    students: 'Students to delete',
    relatedIncidents: 'Related incidents',
    relatedEvidenceFiles: 'Related evidence files',
    relatedIssuedLetters: 'Related issued letters',
    incidents: 'Incidents to delete',
    evidenceFiles: 'Evidence files affected',
    issuedLetters: 'Issued letters affected',
};

const formatLabel = (key) =>
    summaryLabelMap[key] || key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase());

const SummaryGrid = ({ summary }) => (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {Object.entries(summary || {}).map(([key, value]) => (
            <div key={key} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/70">
                <p className="break-words text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {formatLabel(key)}
                </p>
                <p className="mt-2 break-words text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">{value}</p>
            </div>
        ))}
    </div>
);

const BulkDeleteModal = ({ moduleName, mode, ids, source, onClose, onComplete, addToast }) => {
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [confirmation, setConfirmation] = useState('');
    const [loadingPreview, setLoadingPreview] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [portalReady, setPortalReady] = useState(false);
    const dialogRef = useRef(null);
    const title = `${mode === 'all' ? 'Delete All' : 'Delete Filtered'} ${labelMap[moduleName]}`;
    const requiredPhrase = preview?.total >= 100 ? `DELETE ${preview.total}` : 'DELETE';

    useEffect(() => {
        setPortalReady(typeof document !== 'undefined');
    }, []);

    useEffect(() => {
        let mounted = true;
        setLoadingPreview(true);
        setResult(null);
        setConfirmation('');

        apiClient.post(`/api/bulk-delete/${moduleName}/preview`, {
            mode,
            ids: mode === 'filtered' ? ids : undefined,
            source,
        })
            .then(({ data }) => {
                if (mounted) setPreview(data);
            })
            .catch((error) => {
                addToast(error.response?.data?.message || 'Could not prepare bulk delete preview.', 'error');
                onClose();
            })
            .finally(() => {
                if (mounted) setLoadingPreview(false);
            });

        return () => {
            mounted = false;
        };
    }, [addToast, ids, mode, moduleName, onClose, source]);

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;

        const previousOverflow = document.body.style.overflow;
        const previousPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.paddingRight = previousPaddingRight;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !executing) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [executing, onClose]);

    const executeDelete = async () => {
        if (!preview || confirmation.trim() !== requiredPhrase) return;
        setExecuting(true);
        try {
            const { data } = await apiClient.post(`/api/bulk-delete/${moduleName}/execute`, {
                mode,
                ids: mode === 'filtered' ? ids : undefined,
                source,
                confirmation,
            });
            setResult(data);
            addToast(`Bulk delete complete. Deleted ${data.deleted}, failed ${data.failed}.`, data.failed ? 'warning' : 'success');
            try {
                await onComplete?.(data);
            } catch {
                addToast('Bulk delete completed, but the list refresh failed.', 'warning');
            }
            setConfirmation('');
            setPreview(null);
            setResult(null);
            onClose();
        } catch (error) {
            addToast(error.response?.data?.message || 'Bulk delete failed.', 'error');
        } finally {
            setExecuting(false);
        }
    };

    if (!portalReady) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9998] flex min-h-[100dvh] items-end justify-center overflow-hidden bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            role="presentation"
            onMouseDown={(event) => {
                if (!executing && event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="bulk-delete-title"
                className="flex max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[min(92vh,760px)] sm:max-w-2xl sm:rounded-3xl"
            >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-6 sm:py-5">
                    <div className="min-w-0">
                        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span className="truncate">Super Admin Only</span>
                        </div>
                        <h2 id="bulk-delete-title" className="mt-3 break-words text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">{title}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={executing}
                        className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-w-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
                    {loadingPreview ? (
                        <div className="flex min-h-[180px] items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-red-500" />
                        </div>
                    ) : (
                        <>
                            <SummaryGrid summary={preview?.summary} />

                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                                This runs the existing single-record delete flow for every record in batches of 50. Type{' '}
                                <span className="break-words font-bold">{requiredPhrase}</span> to confirm.
                            </div>

                            {!result ? (
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                        Confirmation
                                    </label>
                                    <input
                                        value={confirmation}
                                        onChange={(event) => setConfirmation(event.target.value)}
                                        disabled={executing}
                                        className="mt-2 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-red-500/20"
                                        placeholder={requiredPhrase}
                                    />
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                    Deleted {result.deleted}. Failed {result.failed}. Duration {Math.round((result.durationMs || 0) / 1000)}s.
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:justify-end sm:px-6 sm:py-5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={executing}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                    >
                        {result ? 'Close' : 'Cancel'}
                    </button>
                    {!result ? (
                        <button
                            type="button"
                            onClick={executeDelete}
                            disabled={loadingPreview || executing || !preview?.total || confirmation.trim() !== requiredPhrase}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                            {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Execute Delete
                        </button>
                    ) : null}
                </div>
            </div>
        </div>,
        document.body
    );
};

const BulkDeleteControls = ({ moduleName, filteredIds, allCount, source, onComplete, addToast }) => {
    const [modal, setModal] = useState(null);
    const filteredCount = filteredIds?.length || 0;
    const hasFilteredScope = filteredCount > 0;
    const normalizedIds = useMemo(() => filteredIds || [], [filteredIds]);

    return (
        <>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <button
                    type="button"
                    onClick={() => setModal({ mode: 'filtered', ids: normalizedIds, source })}
                    disabled={!hasFilteredScope}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-red-500/10 sm:w-auto"
                >
                    <Trash2 className="h-4 w-4" />
                    Delete Filtered
                </button>
                <button
                    type="button"
                    onClick={() => setModal({ mode: 'all', ids: [], source })}
                    disabled={!allCount}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                    <Trash2 className="h-4 w-4" />
                    Delete All
                </button>
            </div>
            {modal ? (
                <BulkDeleteModal
                    moduleName={moduleName}
                    mode={modal.mode}
                    ids={modal.ids}
                    source={modal.source}
                    onClose={() => setModal(null)}
                    onComplete={onComplete}
                    addToast={addToast}
                />
            ) : null}
        </>
    );
};

export default BulkDeleteControls;
