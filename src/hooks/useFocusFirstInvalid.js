import { useEffect } from 'react';

export const focusFirstInvalidField = (root = document) => {
    if (!root?.querySelector) return false;
    const invalid = root.querySelector('[aria-invalid="true"], [data-validation-invalid="true"], :invalid');
    if (!invalid) return false;
    const target = typeof invalid.focus === 'function'
        ? invalid
        : invalid.querySelector?.('input, select, textarea, button, [tabindex]');
    if (!target || typeof target.focus !== 'function') return false;
    target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
    return true;
};

const hasErrors = (errors) => Boolean(errors && Object.keys(errors).length > 0);

export const useFocusFirstInvalid = (errors, rootRef = null) => {
    useEffect(() => {
        if (!hasErrors(errors)) return undefined;
        const frame = window.requestAnimationFrame(() => focusFirstInvalidField(rootRef?.current || document));
        return () => window.cancelAnimationFrame(frame);
    }, [errors, rootRef]);
};

export default useFocusFirstInvalid;
