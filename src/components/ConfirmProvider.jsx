import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ConfirmContext = createContext(null);

const toneStyles = {
    danger: {
        icon: AlertTriangle,
        iconClass: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300',
        buttonClass: 'border-rose-700 bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
    },
    warning: {
        icon: AlertTriangle,
        iconClass: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300',
        buttonClass: 'border-amber-700 bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500',
    },
    success: {
        icon: CheckCircle2,
        iconClass: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300',
        buttonClass: 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
    },
    info: {
        icon: Info,
        iconClass: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300',
        buttonClass: 'border-blue-700 bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
    },
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        return async () => false;
    }
    return context;
};

const getFocusableElements = (node) => {
    if (!node) return [];
    return Array.from(
        node.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => !element.disabled && element.getAttribute('aria-hidden') !== 'true');
};

const ConfirmDialog = ({ options, onResolve }) => {
    const dialogRef = useRef(null);
    const cancelButtonRef = useRef(null);
    const previouslyFocusedRef = useRef(null);
    const tone = toneStyles[options.tone] || toneStyles.warning;
    const Icon = tone.icon;
    const titleId = 'confirm-dialog-title';
    const descriptionId = 'confirm-dialog-description';

    useEffect(() => {
        previouslyFocusedRef.current = document.activeElement;
        const timer = window.setTimeout(() => {
            cancelButtonRef.current?.focus();
        }, 0);

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onResolve(false);
                return;
            }

            if (event.key !== 'Tab') return;

            const focusable = getFocusableElements(dialogRef.current);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocusedRef.current?.focus?.();
        };
    }, [onResolve]);

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/25 dark:border-slate-700 dark:bg-slate-900"
            >
                <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone.iconClass}`}>
                        <Icon size={20} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {options.title || 'Confirm action'}
                        </h2>
                        <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {options.description || 'Please confirm that you want to continue.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => onResolve(false)}
                        aria-label="Close confirmation"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                {options.details ? (
                    <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                        {options.details}
                    </div>
                ) : null}
                <div className="flex flex-col-reverse gap-3 px-5 py-4 sm:flex-row sm:justify-end">
                    <button
                        ref={cancelButtonRef}
                        type="button"
                        onClick={() => onResolve(false)}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        {options.cancelLabel || 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={() => onResolve(true)}
                        className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${tone.buttonClass}`}
                    >
                        {options.confirmLabel || 'Continue'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const ConfirmProvider = ({ children }) => {
    const [dialog, setDialog] = useState(null);

    const confirm = useCallback((options = {}) => (
        new Promise((resolve) => {
            setDialog({ options, resolve });
        })
    ), []);

    const handleResolve = useCallback((result) => {
        setDialog((current) => {
            current?.resolve(Boolean(result));
            return null;
        });
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {dialog ? <ConfirmDialog options={dialog.options} onResolve={handleResolve} /> : null}
        </ConfirmContext.Provider>
    );
};

export default ConfirmProvider;
