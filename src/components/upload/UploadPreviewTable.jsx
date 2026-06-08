import React from 'react';
import { AlertTriangle, Eye, Table2 } from 'lucide-react';

const UploadPreviewTable = ({ preview }) => {
    if (!preview) return null;

    const columns = preview.headers?.filter((h) => h !== '__rowNumber') ?? [];
    const hasMissing = (preview.missingColumns?.length ?? 0) > 0;
    const hasIssues  = (preview.rowIssues?.length ?? 0) > 0;

    return (
        <section
            aria-label="Spreadsheet preview"
            className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
        >
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                        <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                        Spreadsheet Preview
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Showing the first {Math.min(preview.totalRows ?? 0, 5)} of {preview.totalRows ?? 0}{' '}
                        {preview.totalRows === 1 ? 'row' : 'rows'} from your file.
                    </p>
                </div>
                <div
                    aria-label={`${preview.totalRows ?? 0} rows detected`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200"
                >
                    <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {preview.totalRows ?? 0} {preview.totalRows === 1 ? 'row' : 'rows'} detected
                </div>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto px-5 pb-5 pt-4 md:block">
                <table className="min-w-[640px] w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            <th scope="col" className="py-2.5 pl-3 pr-4">#</th>
                            {columns.map((col) => (
                                <th key={col} scope="col" className="px-3 py-2.5">{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {preview.rows?.map((row) => (
                            <tr
                                key={`row-${row.__rowNumber}`}
                                className="text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/40"
                            >
                                <td className="py-2.5 pl-3 pr-4 font-semibold text-slate-400 dark:text-slate-500">
                                    {row.__rowNumber}
                                </td>
                                {columns.map((col) => (
                                    <td key={`${row.__rowNumber}-${col}`} className="px-3 py-2.5 break-words">
                                        {String(row[col] ?? '–') || '–'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile card list */}
            <div className="space-y-3 px-4 py-4 md:hidden">
                {preview.rows?.map((row) => (
                    <article
                        key={`card-${row.__rowNumber}`}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    >
                        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                Row {row.__rowNumber}
                            </p>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {columns.map((col) => (
                                <div
                                    key={`${row.__rowNumber}-${col}-m`}
                                    className="grid grid-cols-2 gap-3 px-4 py-2.5"
                                >
                                    <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                        {col}
                                    </span>
                                    <span className="min-w-0 break-words text-right text-sm font-medium text-slate-800 dark:text-slate-100">
                                        {String(row[col] ?? '–') || '–'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </article>
                ))}
            </div>

            {/* Validation notices */}
            {(hasMissing || hasIssues) && (
                <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
                    {hasMissing && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 dark:border-red-500/30 dark:bg-red-950/30">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                            <p className="text-sm text-red-800 dark:text-red-200">
                                <strong className="font-semibold">Missing required columns:</strong>{' '}
                                {preview.missingColumns?.join(', ')}.
                                Please use the sample spreadsheet as a guide.
                            </p>
                        </div>
                    )}
                    {hasIssues && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-500/30 dark:bg-amber-950/30">
                            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                                Rows that need attention
                            </p>
                            <ul className="mt-2.5 space-y-1.5 pl-1">
                                {preview.rowIssues?.map((issue) => (
                                    <li key={`issue-${issue.row}`} className="text-sm text-amber-900 dark:text-amber-200">
                                        <strong>Row {issue.row}:</strong> {issue.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default UploadPreviewTable;
