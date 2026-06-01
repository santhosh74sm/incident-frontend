import React from 'react';
import { Eye, Table2 } from 'lucide-react';

const UploadPreviewTable = ({ preview }) => {
    if (!preview) return null;

    const columns = preview.headers?.filter((header) => header !== '__rowNumber') || [];

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/50 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                        <Eye className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                        Validation Preview
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Showing the first {Math.min(preview.totalRows || 0, 5)} rows before the final upload.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100">
                    <Table2 className="h-4 w-4" />
                    {preview.totalRows || 0} row{preview.totalRows === 1 ? '' : 's'} detected
                </div>
            </div>

            <div className="hidden overflow-x-auto px-5 py-4 md:block">
                <table className="min-w-[720px] text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            <th className="px-3 py-2 font-semibold">Row</th>
                            {columns.map((column) => (
                                <th key={column} className="px-3 py-2 font-semibold">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {preview.rows?.map((row) => (
                            <tr key={`preview-row-${row.__rowNumber}`} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                                <td className="px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">{row.__rowNumber}</td>
                                {columns.map((column) => (
                                    <td key={`${row.__rowNumber}-${column}`} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                        {String(row[column] ?? '-') || '-'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="space-y-3 px-4 py-4 md:hidden">
                {preview.rows?.map((row) => (
                    <article
                        key={`preview-card-${row.__rowNumber}`}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                Row {row.__rowNumber}
                            </p>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {columns.map((column) => (
                                <div key={`${row.__rowNumber}-${column}-mobile`} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 px-4 py-3">
                                    <span className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                        {column}
                                    </span>
                                    <span className="min-w-0 break-words text-right text-sm font-medium text-slate-800 dark:text-slate-100">
                                        {String(row[column] ?? '-') || '-'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </article>
                ))}
            </div>

            {((preview.missingColumns?.length || 0) > 0 || (preview.rowIssues?.length || 0) > 0) && (
                <div className="space-y-3 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
                    {(preview.missingColumns?.length || 0) > 0 && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            Missing required columns: <strong>{preview.missingColumns?.join(', ')}</strong>.
                        </div>
                    )}

                    {(preview.rowIssues?.length || 0) > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p className="font-semibold">Rows needing attention</p>
                            <div className="mt-2 space-y-2">
                                {preview.rowIssues?.map((issue) => (
                                    <p key={`issue-${issue.row}`} className="text-sm">
                                        Row {issue.row}: {issue.reason}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UploadPreviewTable;
