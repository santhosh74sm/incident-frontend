import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = 'input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"])';

export const focusAndScrollField = (field) => {
    if (!field || typeof field.focus !== 'function') return false;
    field.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    try {
        field.focus({ preventScroll: true });
    } catch {
        field.focus();
    }
    return true;
};

export const focusFirstInvalidField = (root = document) => {
    if (!root?.querySelector) return false;
    const candidates = root.querySelectorAll(
        `[aria-invalid="true"], [data-validation-invalid="true"], ${FOCUSABLE_SELECTOR}:invalid`
    );
    for (const invalid of candidates) {
        const target = invalid.matches?.(FOCUSABLE_SELECTOR)
            ? invalid
            : invalid.querySelector?.(FOCUSABLE_SELECTOR);
        if (target && !target.disabled && target.getClientRects().length > 0) {
            return focusAndScrollField(target);
        }
    }
    return false;
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
