import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';

const bannerStyles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100',
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100',
    info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-100',
};

const bannerIcons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Sparkles,
};

const UploadStatusBanner = ({ message }) => {
    if (!message?.text) return null;

    const Icon = bannerIcons[message.type] || bannerIcons.info;

    return (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${bannerStyles[message.type] || bannerStyles.info}`}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{message.text}</p>
        </div>
    );
};

export default UploadStatusBanner;
