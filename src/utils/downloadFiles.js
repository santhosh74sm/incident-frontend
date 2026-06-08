import { Capacitor } from '@capacitor/core';

const DOWNLOAD_SUBDIRECTORY = 'Incident Tracking System';
const OPEN_DIR = 'open-cache';
const NATIVE_OPEN_DIRECTORY = 'CACHE';

let nativePluginPromise = null;
let filesystemPromise = null;

const logDownloadStep = (step, details = {}) => {
    if (process.env.NODE_ENV !== 'development') return;
    // Keep diagnostics metadata-only so URLs and native filesystem paths are not exposed.
    console.info(`[download] ${step}`, details);
};

export const isNativeDownloadPlatform = () =>
    typeof Capacitor?.isNativePlatform === 'function' && Capacitor.isNativePlatform();

const ensureNativeDownloadPlugins = async () => {
    if (!isNativeDownloadPlatform()) {
        throw new Error('Native download plugins are only available on native platforms.');
    }

    if (!nativePluginPromise) {
        nativePluginPromise = import('@capacitor/core').then(({ registerPlugin }) => ({
            NativeFileOpener: registerPlugin('NativeFileOpener'),
            NativeDownloadManager: registerPlugin('NativeDownloadManager'),
        }));
    }

    return nativePluginPromise;
};

const ensureFilesystem = async () => {
    if (!isNativeDownloadPlatform()) {
        throw new Error('Filesystem is only available on native platforms.');
    }

    if (!filesystemPromise) {
        filesystemPromise = import('@capacitor/filesystem').then(({ Directory, Filesystem }) => ({
            Directory,
            Filesystem,
        }));
    }

    return filesystemPromise;
};

export const sanitizeDownloadFilename = (filename = 'download') => {
    const withoutControlChars = Array.from(String(filename || 'download'))
        .filter((char) => char.charCodeAt(0) >= 32)
        .join('');
    const clean = withoutControlChars
        .trim()
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^\.+/, '')
        .slice(0, 160);

    return clean || 'download';
};

const webDownloadBlob = (blob, filename) => {
    logDownloadStep('web-download-start', { filename, size: blob?.size, type: blob?.type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    logDownloadStep('web-download-complete', { filename });
};

const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = String(reader.result || '');
            resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const inferMimeType = (filename, explicitType = '') => {
    if (explicitType) return explicitType;

    const extension = String(filename || '').split('.').pop()?.toLowerCase();
    const types = {
        csv: 'text/csv',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        gif: 'image/gif',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        pdf: 'application/pdf',
        png: 'image/png',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        txt: 'text/plain',
        webp: 'image/webp',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return types[extension] || 'application/octet-stream';
};

export const saveBlobToPublicDownloads = async (blob, filename, options = {}) => {
    const { NativeDownloadManager } = await ensureNativeDownloadPlugins();
    const safeFilename = sanitizeDownloadFilename(filename);
    const mimeType = inferMimeType(safeFilename, options.mimeType || blob.type);

    logDownloadStep('native-public-download-start', {
        filename: safeFilename,
        mimeType,
        size: blob?.size,
        subdirectory: options.subdirectory || DOWNLOAD_SUBDIRECTORY,
    });

    try {
        const base64Data = await blobToBase64(blob);
        logDownloadStep('native-public-download-base64-ready', {
            filename: safeFilename,
            base64Length: base64Data.length,
        });

        const result = await NativeDownloadManager.saveToDownloads({
            base64Data,
            filename: safeFilename,
            mimeType,
            subdirectory: options.subdirectory || DOWNLOAD_SUBDIRECTORY,
        });

        logDownloadStep('native-public-download-complete', {
            filename: safeFilename,
            hasUri: Boolean(result?.uri),
            hasPath: Boolean(result?.path),
        });

        return {
            ...result,
            filename: safeFilename,
            mimeType,
            native: true,
            public: true,
            displayPath: result?.displayPath || result?.path || `Downloads/${options.subdirectory || DOWNLOAD_SUBDIRECTORY}/${safeFilename}`,
        };
    } catch (error) {
        logDownloadStep('native-public-download-error', {
            filename: safeFilename,
            message: error?.message,
            error,
        });
        throw error;
    }
};

export const saveBlobForNativeOpen = async (blob, filename, options = {}) => {
    const { Directory, Filesystem } = await ensureFilesystem();
    const safeFilename = sanitizeDownloadFilename(filename);
    const base64Data = await blobToBase64(blob);
    const path = `${options.directoryName || OPEN_DIR}/${safeFilename}`;
    const directory = options.directory || Directory.Cache || NATIVE_OPEN_DIRECTORY;
    const mimeType = inferMimeType(safeFilename, options.mimeType || blob.type);

    logDownloadStep('native-open-cache-write-start', {
        filename: safeFilename,
        mimeType,
        size: blob?.size,
    });

    try {
        const writeResult = await Filesystem.writeFile({
            path,
            data: base64Data,
            directory,
            recursive: true,
        });

        logDownloadStep('native-open-cache-write-complete', {
            filename: safeFilename,
            hasUri: Boolean(writeResult?.uri),
        });

        const uriResult = await Filesystem.getUri({
            path,
            directory,
        });

        logDownloadStep('native-open-cache-get-uri-complete', {
            filename: safeFilename,
            hasUri: Boolean(uriResult?.uri),
        });

        return {
            uri: uriResult.uri,
            filename: safeFilename,
            path,
            displayPath: path,
            directory,
            native: true,
            public: false,
            mimeType,
        };
    } catch (error) {
        logDownloadStep('native-open-cache-error', {
            filename: safeFilename,
            message: error?.message,
        });
        throw error;
    }
};

export const openNativeFile = async (savedFile) => {
    const { NativeFileOpener } = await ensureNativeDownloadPlugins();
    logDownloadStep('native-open-viewer-start', {
        mimeType: savedFile?.mimeType,
        hasUri: Boolean(savedFile?.uri),
    });

    await NativeFileOpener.open({
        uri: savedFile.uri,
        mimeType: savedFile.mimeType || inferMimeType(savedFile.filename),
    });

    logDownloadStep('native-open-viewer-complete', {
        hasUri: Boolean(savedFile?.uri),
    });

    return savedFile;
};

export const downloadBlob = async (blob, filename, options = {}) => {
    const safeFilename = sanitizeDownloadFilename(filename);

    logDownloadStep('download-start', {
        filename: safeFilename,
        native: isNativeDownloadPlatform(),
        platform: Capacitor.getPlatform?.(),
    });

    if (!isNativeDownloadPlatform()) {
        webDownloadBlob(blob, safeFilename);
        return { filename: safeFilename, native: false, displayPath: safeFilename };
    }

    return saveBlobToPublicDownloads(blob, safeFilename, options);
};

export const downloadRemoteFile = async (url, filename, options = {}) => {
    logDownloadStep('remote-download-fetch-start', { filename });
    const response = await fetch(url, {
        credentials: 'include',
        ...(options.fetchOptions || {}),
    });

    logDownloadStep('remote-download-fetch-complete', {
        filename,
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
        throw new Error(options.errorMessage || `File download failed with HTTP ${response.status}.`);
    }

    const blob = await response.blob();
    return downloadBlob(blob, filename, options);
};

export const openBlob = async (blob, filename, options = {}) => {
    const safeFilename = sanitizeDownloadFilename(filename);

    logDownloadStep('open-start', {
        filename: safeFilename,
        native: isNativeDownloadPlatform(),
        platform: Capacitor.getPlatform?.(),
    });

    if (!isNativeDownloadPlatform()) {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => window.URL.revokeObjectURL(url), 30000);
        logDownloadStep('web-open-complete', { filename: safeFilename });
        return { filename: safeFilename, native: false };
    }

    const savedFile = await saveBlobForNativeOpen(blob, safeFilename, options);
    return openNativeFile(savedFile);
};

export const openRemoteFile = async (url, filename, options = {}) => {
    logDownloadStep('remote-open-fetch-start', { filename });
    const response = await fetch(url, {
        credentials: 'include',
        ...(options.fetchOptions || {}),
    });

    logDownloadStep('remote-open-fetch-complete', {
        filename,
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
        throw new Error(options.errorMessage || `File open failed with HTTP ${response.status}.`);
    }

    const blob = await response.blob();
    return openBlob(blob, filename, options);
};

export const downloadWorkbook = async (XLSX, workbook, filename, options = {}) => {
    const safeFilename = sanitizeDownloadFilename(filename);

    logDownloadStep('workbook-download-start', {
        filename: safeFilename,
        native: isNativeDownloadPlatform(),
        platform: Capacitor.getPlatform?.(),
    });

    if (!isNativeDownloadPlatform()) {
        XLSX.writeFile(workbook, safeFilename);
        logDownloadStep('workbook-web-download-complete', { filename: safeFilename });
        return { filename: safeFilename, native: false, displayPath: safeFilename };
    }

    const mimeType = options.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const base64Data = XLSX.write(workbook, {
        type: 'base64',
        bookType: options.bookType || 'xlsx',
    });
    const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then((response) => response.blob());

    return saveBlobToPublicDownloads(blob, safeFilename, {
        ...options,
        mimeType,
    });
};

export const parseDownloadFilename = (contentDisposition, fallback = 'download') => {
    const header = String(contentDisposition || '');
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return sanitizeDownloadFilename(decodeURIComponent(utf8Match[1]));
        } catch {
            return sanitizeDownloadFilename(utf8Match[1]);
        }
    }

    const plainMatch = header.match(/filename="?([^";]+)"?/i);
    return sanitizeDownloadFilename(plainMatch?.[1] || fallback);
};
