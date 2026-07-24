const rawScannerApiUrl =
  process.env.REACT_APP_SCANNER_API_URL ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SCANNER_API_URL);
export const API_BASE = (rawScannerApiUrl && rawScannerApiUrl.trim() !== '' ? rawScannerApiUrl : 'http://127.0.0.1:8001').replace(/\/+$/, '');

export function formatApiUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function extractErrorMessage(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await response.json().catch(() => null);
    if (body?.detail) return body.detail;
  }
  if (response.status === 404) {
    return 'Session timed out or document not found. Please upload again.';
  }
  return `Unable to connect to document server (Status ${response.status}).`;
}

export function createCombinedSignal(signal1, signal2) {
  const controller = new AbortController();

  const onAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  if (signal1) {
    if (signal1.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal1.addEventListener('abort', onAbort, { once: true });
  }

  if (signal2) {
    if (signal2.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal2.addEventListener('abort', onAbort, { once: true });
  }

  return controller.signal;
}

export async function apiFetch(url, options = {}) {
  const { timeoutMs = 60000, retries = 2, signal, ...fetchOptions } = options;

  let attempt = 0;
  while (attempt <= retries) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const combinedSignal = createCombinedSignal(signal, timeoutController.signal);

    try {
      const response = await fetch(url, { ...fetchOptions, signal: combinedSignal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (signal?.aborted) {
        throw new Error('Request cancelled.');
      }
      if (timeoutController.signal.aborted) {
        throw new Error('Request timed out. Please try again.');
      }
      if (attempt < retries && err instanceof Error && err.name !== 'AbortError') {
        attempt++;
        const delayMs = 800 * attempt;
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unable to connect. Please check your network connection.');
}

export function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await apiFetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await uploadRes.json();
  const formattedUrl = formatApiUrl(data.image_url);
  preloadImage(formattedUrl);

  const detectRes = await apiFetch(`${API_BASE}/detect?session_id=${data.session_id}`, {
    method: 'POST',
  });
  const detectData = await detectRes.json();

  return {
    upload: data,
    corners: detectData.corners,
  };
}

export async function detectDocumentCorners(sessionId) {
  const detectRes = await apiFetch(`${API_BASE}/detect?session_id=${sessionId}`, {
    method: 'POST',
  });
  const detectData = await detectRes.json();
  return detectData.corners;
}

export async function cropDocument(sessionId, corners) {
  const cropRes = await apiFetch(`${API_BASE}/crop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      corners,
    }),
  });

  const data = await cropRes.json();
  const formattedUrl = formatApiUrl(data.image_url);
  preloadImage(formattedUrl);
  return formattedUrl;
}

export async function enhanceDocument(sessionId, mode, signal) {
  const enhanceRes = await apiFetch(`${API_BASE}/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      mode,
    }),
    signal,
  });

  const data = await enhanceRes.json();
  const formattedUrl = formatApiUrl(data.image_url);
  preloadImage(formattedUrl);
  return formattedUrl;
}

export function getDownloadUrl(sessionId, format = 'png') {
  return `${API_BASE}/download?session_id=${sessionId}&format=${format}`;
}

export async function fetchScannedFile(sessionId, finalUrl, originalFileName = 'document') {
  const downloadUrl = sessionId ? getDownloadUrl(sessionId, 'png') : null;
  const targetUrls = [downloadUrl, finalUrl].filter(Boolean);

  let blob = null;

  for (const url of targetUrls) {
    try {
      const response = await apiFetch(url, { retries: 1 });
      if (response.ok) {
        blob = await response.blob();
        if (blob && blob.size > 0) break;
      }
    } catch {
      // Continue to fallback
    }
  }

  if (!blob && finalUrl) {
    blob = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Canvas blob generation failed.'))),
            'image/png'
          );
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Image load failed for blob conversion.'));
      img.src = finalUrl;
    });
  }

  if (!blob) {
    throw new Error('Could not retrieve improved document.');
  }

  const cleanBaseName = originalFileName ? originalFileName.replace(/\.[^/.]+$/, '') : 'document';
  const scannedFileName = `${cleanBaseName}_scanned.png`;

  return new File([blob], scannedFileName, {
    type: blob.type || 'image/png',
    lastModified: Date.now(),
  });
}

