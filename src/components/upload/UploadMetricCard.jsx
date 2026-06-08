import React from 'react';

const TONES = {
    slate:   'bg-white/10 text-white ring-white/15',
    blue:    'bg-white/10 text-white ring-white/15',
    indigo:  'bg-white/10 text-white ring-white/15',
    emerald: 'bg-white/10 text-white ring-white/15',
};

/**
 * Compact stat tile used inside hero-band headers.
 * All variants intentionally use white-on-dark so they sit naturally
 * on the dark gradient header background.
 */
const UploadMetricCard = ({ icon: Icon, label, value, tone = 'slate' }) => (
    <div className={`rounded-xl px-4 py-3 ring-1 ${TONES[tone] || TONES.slate}`}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
        </div>
        <p className="mt-1.5 text-base font-bold text-white">{value}</p>
    </div>
);

export default UploadMetricCard;
