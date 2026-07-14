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
            <div className="h-full rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-3">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${SURFACE_ICON[tone] || SURFACE_ICON.slate}`}>
                        <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ">
                            {label}
                        </p>
                        <p className="mt-1.5 break-words text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                            {value}
                        </p>
                        {helper ? <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p> : null}
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
