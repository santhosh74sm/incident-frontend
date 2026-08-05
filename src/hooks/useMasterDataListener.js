import { useEffect } from 'react';

export const MASTER_DATA_UPDATED_EVENT = 'master-data:updated';

export const notifyMasterDataUpdated = (detail = {}) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(MASTER_DATA_UPDATED_EVENT, { detail }));
    }
};

export const useMasterDataListener = (callback) => {
    useEffect(() => {
        if (typeof window === 'undefined' || typeof callback !== 'function') return;

        const handleEvent = (event) => {
            callback(event.detail || {});
        };

        window.addEventListener(MASTER_DATA_UPDATED_EVENT, handleEvent);
        return () => {
            window.removeEventListener(MASTER_DATA_UPDATED_EVENT, handleEvent);
        };
    }, [callback]);
};

export default useMasterDataListener;
