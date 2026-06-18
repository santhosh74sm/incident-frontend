import React, { useState, useCallback, createContext, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        // Fallback for components rendered outside the provider tree
        return { addToast: () => {} };
    }
    return context;
};

const TOAST_DURATION_MS = 3000;

const TOAST_STYLES = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
};

const TOAST_LABELS = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
};

const Toast = ({ message, type, onClose }) => (
    <div
        role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
        aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
        aria-atomic="true"
        className={`${TOAST_STYLES[type] || TOAST_STYLES.info} flex w-[calc(100vw-2rem)] max-w-md animate-slide-in items-center gap-3 rounded-xl px-4 py-3 text-white shadow-lg sm:w-auto sm:min-w-[280px]`}
    >
        <span className="sr-only">{TOAST_LABELS[type] || TOAST_LABELS.info}: </span>
        <span className="flex-1 text-sm font-medium">{message}</span>
        <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss notification"
            className="text-white/80 transition-colors hover:text-white"
        >
            <X size={16} />
        </button>
    </div>
);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const nextToastIdRef = useRef(0);

    const addToast = useCallback((message, type = 'success') => {
        nextToastIdRef.current += 1;
        const id = `toast-${Date.now()}-${nextToastIdRef.current}`;
        setToasts((current) => [...current, { id, message, type }]);
        setTimeout(() => {
            setToasts((current) => current.filter((t) => t.id !== id));
        }, TOAST_DURATION_MS);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((current) => current.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {createPortal(
                <div
                    className="fixed left-4 right-4 top-16 z-[9999] flex flex-col items-end gap-2 sm:left-auto sm:top-4"
                    aria-label="Application notifications"
                >
                    {toasts.map((toast) => (
                        <Toast
                            key={toast.id}
                            message={toast.message}
                            type={toast.type}
                            onClose={() => removeToast(toast.id)}
                        />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
};

export default ToastProvider;
