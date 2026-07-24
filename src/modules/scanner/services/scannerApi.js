const rawApiUrl = process.env.REACT_APP_API_URL || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL);
export const API_BASE = (rawApiUrl && rawApiUrl.trim() !== '' ? rawApiUrl : '/api').replace(/\/+$/, '');

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
    return 'Session expired or image resource not found. Please upload again.';
  }
  return `Server request failed with status ${response.status}.`;
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
        throw new Error('Server request timed out. Please try again.');
      }
      if (attempt < retries && err instanceof Error && err.name !== 'AbortError') {
        attempt++;
        await new Promise((res) => setTimeout(res, 800 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Network request failed after retries.');
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
