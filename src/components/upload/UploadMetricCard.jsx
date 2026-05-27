import React from 'react';

const UploadMetricCard = ({ icon: Icon, label, value, tone = 'slate' }) => {
    const tones = {
        slate: 'bg-slate-50 text-slate-800 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700',
        blue: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-100 dark:ring-blue-500/30',
        indigo: 'bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-100 dark:ring-indigo-500/30',
        emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-500/30',
    };

    return (
        <div className={`rounded-xl px-4 py-3 ring-1 ${tones[tone] || tones.slate}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <Icon className="h-4 w-4" />
                {label}
            </div>
            <p className="mt-2 text-lg font-bold">{value}</p>
        </div>
    );
};

export default UploadMetricCard;
