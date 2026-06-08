import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const STYLES = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100',
    error:   'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100',
    info:    'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-100',
};

const ICONS = {
    success: CheckCircle2,
    error:   AlertCircle,
    warning: AlertTriangle,
    info:    Info,
};

const UploadStatusBanner = ({ message }) => {
    if (!message?.text) return null;

    const type = message.type in STYLES ? message.type : 'info';
    const Icon = ICONS[type];

    return (
        <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${STYLES[type]}`}
        >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium leading-relaxed">{message.text}</p>
        </div>
    );
};

export default UploadStatusBanner;
