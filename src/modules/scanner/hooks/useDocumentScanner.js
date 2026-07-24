import { useState, useRef, useEffect, useCallback } from 'react';
import {
  uploadDocument,
  detectDocumentCorners,
  cropDocument,
  enhanceDocument,
} from '../services/scannerApi';

export function useDocumentScanner() {
  const [step, setStep] = useState(0);
  const [upload, setUpload] = useState(undefined);
  const [corners, setCorners] = useState([]);
  const [cropUrl, setCropUrl] = useState('');
  const [finalUrl, setFinalUrl] = useState('');
  const [mode, setMode] = useState('black_white');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const enhanceAbortRef = useRef(null);

  const handleUpload = useCallback(async (file) => {
    setBusy(true);
    setError('');
    try {
      const result = await uploadDocument(file);
      setUpload(result.upload);
      setCorners(result.corners);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload or process this document.');
    } finally {
      setBusy(false);
    }
  }, []);

  const initWithFile = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const result = await uploadDocument(file);
      setUpload(result.upload);
      setCorners(result.corners);
      setStep(1); // Jump directly to Crop step (Step 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document scanner unavailable. Could not process document.');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const handleAutoDetect = useCallback(async () => {
    if (!upload) return;
    setBusy(true);
    setError('');
    try {
      const newCorners = await detectDocumentCorners(upload.session_id);
      setCorners(newCorners);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Automatic document selection was unavailable.');
    } finally {
      setBusy(false);
    }
  }, [upload]);

  const handleCrop = useCallback(async () => {
    if (!upload) return;
    setBusy(true);
    setError('');
    try {
      const url = await cropDocument(upload.session_id, corners);
      setCropUrl(url);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please keep all four corners inside the document.');
    } finally {
      setBusy(false);
    }
  }, [upload, corners]);

  const handleEnhance = useCallback(async (selectedMode = mode) => {
    if (!upload) return;

    if (enhanceAbortRef.current) {
      enhanceAbortRef.current.abort();
    }
    const controller = new AbortController();
    enhanceAbortRef.current = controller;

    setBusy(true);
    setError('');
    try {
      const url = await enhanceDocument(upload.session_id, selectedMode, controller.signal);
      setFinalUrl(url);
    } catch (err) {
      if (err instanceof Error && err.message === 'Request cancelled.') return;
      setError(err instanceof Error ? err.message : 'Could not apply selected document style.');
    } finally {
      if (enhanceAbortRef.current === controller) {
        setBusy(false);
      }
    }
  }, [upload, mode]);

  useEffect(() => {
    if (step === 3 && upload) {
      handleEnhance();
    }
  }, [step, upload, handleEnhance]);

  const restartScanner = useCallback(() => {
    if (enhanceAbortRef.current) {
      enhanceAbortRef.current.abort();
    }
    setStep(0);
    setUpload(undefined);
    setCropUrl('');
    setFinalUrl('');
    setCorners([]);
    setMode('black_white');
    setError('');
  }, []);

  return {
    step,
    setStep,
    upload,
    corners,
    setCorners,
    cropUrl,
    finalUrl,
    mode,
    setMode,
    busy,
    error,
    setError,
    handleUpload,
    initWithFile,
    handleAutoDetect,
    handleCrop,
    handleEnhance,
    restartScanner,
  };
}
