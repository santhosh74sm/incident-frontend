import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const DOWNLOAD_DIR = 'downloads';
const OPEN_DIR = 'open-cache';
const NATIVE_DOWNLOAD_DIRECTORY = Directory.External;
const NATIVE_OPEN_DIRECTORY = Directory.Cache;
const NativeFileOpener = registerPlugin('NativeFileOpener');

export const isNativeDownloadPlatform = () =>
    typeof Capacitor?.isNativePlatform === 'function' && Capacitor.isNativePlatform();

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
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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

export const saveBlobForNative = async (blob, filename, options = {}) => {
    const safeFilename = sanitizeDownloadFilename(filename);
    const base64Data = await blobToBase64(blob);
    const path = `${options.directoryName || DOWNLOAD_DIR}/${safeFilename}`;
    const directory = options.directory || NATIVE_DOWNLOAD_DIRECTORY;

    await Filesystem.writeFile({
        path,
        data: base64Data,
        directory,
        recursive: true,
    });

    const { uri } = await Filesystem.getUri({
        path,
        directory,
    });

    return {
        uri,
        filename: safeFilename,
        path,
        directory,
        native: true,
        mimeType: inferMimeType(safeFilename, options.mimeType || blob.type),
    };
};

export const openNativeFile = async (savedFile) => {
    await NativeFileOpener.open({
        uri: savedFile.uri,
        mimeType: savedFile.mimeType || inferMimeType(savedFile.filename),
    });

    return savedFile;
};

export const downloadBlob = async (blob, filename, options = {}) => {
    const safeFilename = sanitizeDownloadFilename(filename);

    if (!isNativeDownloadPlatform()) {
        webDownloadBlob(blob, safeFilename);
        return { filename: safeFilename, native: false };
    }

    return saveBlobForNative(blob, safeFilename, options);
};

export const downloadRemoteFile = async (url, filename, options = {}) => {
    const response = await fetch(url, {
        credentials: 'include',
        ...(options.fetchOptions || {}),
    });

    if (!response.ok) {
        throw new Error(options.errorMessage || 'File download failed.');
    }

    const blob = await response.blob();
    return downloadBlob(blob, filename, options);
};

export const openBlob = async (blob, filename, options = {}) => {
    const safeFilename = sanitizeDownloadFilename(filename);

    if (!isNativeDownloadPlatform()) {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => window.URL.revokeObjectURL(url), 30000);
        return { filename: safeFilename, native: false };
    }

    const savedFile = await saveBlobForNative(blob, safeFilename, {
        ...options,
        directory: NATIVE_OPEN_DIRECTORY,
        directoryName: OPEN_DIR,
    });
    return openNativeFile(savedFile);
};

export const openRemoteFile = async (url, filename, options = {}) => {
    const response = await fetch(url, {
        credentials: 'include',
        ...(options.fetchOptions || {}),
    });

    if (!response.ok) {
        throw new Error(options.errorMessage || 'File open failed.');
    }

    const blob = await response.blob();
    return openBlob(blob, filename, options);
};

export const downloadWorkbook = async (XLSX, workbook, filename, options = {}) => {
    const safeFilename = sanitizeDownloadFilename(filename);

    if (!isNativeDownloadPlatform()) {
        XLSX.writeFile(workbook, safeFilename);
        return { filename: safeFilename, native: false };
    }

    const base64Data = XLSX.write(workbook, {
        type: 'base64',
        bookType: options.bookType || 'xlsx',
    });
    const blob = await fetch(
        `data:${options.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};base64,${base64Data}`
    ).then((response) => response.blob());

    return saveBlobForNative(blob, safeFilename, options);
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
