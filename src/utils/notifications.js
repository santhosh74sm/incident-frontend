export const showSuccess = (addToast, message = 'Completed successfully.') => {
    addToast?.(message, 'success');
};

export const showError = (addToast, message = 'Something went wrong. Please try again.') => {
    addToast?.(message, 'error');
};

export const showWarning = (addToast, message = 'Please review and try again.') => {
    addToast?.(message, 'warning');
};

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
    error?.response?.data?.message || error?.message || fallback;
