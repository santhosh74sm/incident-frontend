import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const ConfirmContext = createContext(null);

const TONE_CLASSES = {
    danger: {
        confirm: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        icon: 'bg-red-100 text-red-600',
    },
    warning: {
        confirm: 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500',
        icon: 'bg-amber-100 text-amber-600',
    },
    info: {
        confirm: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
        icon: 'bg-blue-100 text-blue-600',
    },
};

const DEFAULT_OPTIONS = {
    tone: 'info',
    title: 'Confirm action',
    description: 'Are you sure you want to continue?',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
};

const ConfirmProvider = ({ children }) => {
    const [dialog, setDialog] = useState(null);

    const closeDialog = useCallback((result) => {
        setDialog((current) => {
            current?.resolve?.(result);
            return null;
        });
    }, []);

    const confirm = useCallback((options = {}) => (
        new Promise((resolve) => {
            setDialog({ ...DEFAULT_OPTIONS, ...options, resolve });
        })
    ), []);

    const value = useMemo(() => confirm, [confirm]);
    const tone = TONE_CLASSES[dialog?.tone] || TONE_CLASSES.info;

    return (
        <ConfirmContext.Provider value={value}>
            {children}
            {dialog ? createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="confirm-dialog-title"
                        aria-describedby="confirm-dialog-description"
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20 dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="flex items-start gap-4">
                            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                                <span className="text-lg font-bold">!</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                    {dialog.title}
                                </h2>
                                <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    {dialog.description}
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => closeDialog(false)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                {dialog.cancelLabel}
                            </button>
                            <button
                                type="button"
                                onClick={() => closeDialog(true)}
                                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${tone.confirm}`}
                            >
                                {dialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            ) : null}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        return async () => false;
    }
    return context;
};

export default ConfirmProvider;
