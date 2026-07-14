import React from 'react';

const TONES = {
    slate:   'bg-white/10 text-white ring-white/15',
    blue:    'bg-white/10 text-white ring-white/15',
    indigo:  'bg-white/10 text-white ring-white/15',
    emerald: 'bg-white/10 text-white ring-white/15',
};

const SURFACE_ICON = {
    slate: 'bg-slate-100 text-slate-700 ',
    blue: 'bg-blue-50 text-blue-700 ',
    indigo: 'bg-indigo-50 text-indigo-700 ',
    emerald: 'bg-emerald-50 text-emerald-700 ',
};

const UploadMetricCard = ({ icon: Icon, label, value, tone = 'slate', variant = 'solid', helper = null }) => {
    if (variant === 'surface') {
        return (
            <div className="dashboard-stat-card h-full">
                <div className="flex items-start gap-4">
                    <span className={`shrink-0 rounded-full p-3 ${SURFACE_ICON[tone] || SURFACE_ICON.slate}`}>
                        <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="dashboard-kicker">
                            {label}
                        </p>
                        <p className="dashboard-stat-value break-words text-2xl sm:text-[30px]">
                            {value}
                        </p>
                        {helper ? <p className="mt-2 text-sm text-slate-600">{helper}</p> : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-xl px-4 py-3 ring-1 ${TONES[tone] || TONES.slate}`}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
            </div>
            <p className="mt-1.5 text-base font-bold text-white">{value}</p>
            {helper ? <p className="mt-2 text-sm text-white/80">{helper}</p> : null}
        </div>
    );
};

export default UploadMetricCard;
