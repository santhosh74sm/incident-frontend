import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useDocumentScanner } from '../hooks/useDocumentScanner';
import { ProgressIndicator } from './ProgressIndicator';
import { CropStep } from './CropStep';
import { CompareStep } from './CompareStep';
import { EnhanceStep } from './EnhanceStep';
import { FinalStep } from './FinalStep';
import { formatApiUrl, fetchScannedFile } from '../services/scannerApi';
import '../styles/scanner.css';

export function ScannerModal({
  open,
  file,
  onComplete,
  onCancel,
}) {
  const {
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
    initWithFile,
    handleAutoDetect,
    handleCrop,
    handleEnhance,
    restartScanner,
  } = useDocumentScanner();

  const [initFailed, setInitFailed] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (open && file) {
      setInitFailed(false);
      initWithFile(file).catch(() => {
        setInitFailed(true);
      });
    } else if (!open) {
      restartScanner();
      setInitFailed(false);
    }
  }, [open, file, initWithFile, restartScanner]);

  const handleUseScannedCopy = useCallback(async () => {
    if (!upload || converting) return;
    setConverting(true);
    setError('');

    try {
      const scannedFile = await fetchScannedFile(
        upload.session_id,
        finalUrl || formatApiUrl(upload.image_url),
        file?.name || 'document'
      );

      onComplete(scannedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare scanned file for attachment.');
    } finally {
      setConverting(false);
    }
  }, [upload, finalUrl, file, onComplete, converting, setError]);

  const originalPreviewUrl = useMemo(() => {
    if (file) {
      return URL.createObjectURL(file);
    }
    return upload ? formatApiUrl(upload.image_url) : '';
  }, [file, upload]);

  if (!open) return null;

  return (
    <div
      className="scanner-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#090d16',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      <div className="scanner-container" style={{ flex: 1, minHeight: '100vh' }}>
        <header style={{ position: 'relative' }}>
          <div className="brand">
            <span>▣</span> Incident Document Scanner
          </div>
          <button
            onClick={onCancel}
            type="button"
            className="secondary"
            style={{ width: 'auto', padding: '8px 16px', minHeight: '38px', borderRadius: '8px' }}
          >
            <X size={16} /> Cancel & Return Original
          </button>
        </header>

        <ProgressIndicator currentStep={step} />

        <section className="scanner-step-wrapper">
          {busy && step === 0 && !initFailed && (
            <div className="spinner-box" style={{ marginTop: '100px' }}>
              <div className="spinner" />
              <p style={{ marginTop: '16px', fontSize: '1.1rem' }}>
                Preparing your document...
              </p>
            </div>
          )}

          {initFailed && (
            <div
              className="center-page"
              style={{
                marginTop: '60px',
                padding: '32px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '16px',
                maxWidth: '600px',
                margin: '60px auto 0',
              }}
            >
              <AlertTriangle size={48} style={{ color: '#f87171', marginBottom: '16px' }} />
              <h2 style={{ color: '#ffffff', marginBottom: '8px' }}>Unable to Scan Document</h2>
              <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
                The document scanner could not process this file right now. You can try again or keep the original document.
              </p>
              <div className="actions" style={{ flexDirection: 'row', gap: '12px' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setInitFailed(false);
                    initWithFile(file).catch(() => setInitFailed(true));
                  }}
                >
                  Try Again
                </button>
                <button type="button" className="primary" onClick={onCancel}>
                  Keep Original Document
                </button>
              </div>
            </div>
          )}

          {step === 1 && upload && (
            <CropStep
              image={formatApiUrl(upload.image_url)}
              corners={corners}
              imageWidth={upload.width}
              imageHeight={upload.height}
              onChange={setCorners}
              onNext={handleCrop}
              onBack={onCancel}
              onAuto={handleAutoDetect}
              busy={busy}
            />
          )}

          {step === 2 && upload && (
            <CompareStep
              original={formatApiUrl(upload.image_url)}
              corrected={cropUrl}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <EnhanceStep
              image={finalUrl}
              mode={mode}
              setMode={setMode}
              onEnhance={handleEnhance}
              busy={busy}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}

          {step === 4 && upload && (
            <FinalStep
              image={finalUrl}
              originalImage={originalPreviewUrl}
              session={upload.session_id}
              restart={restartScanner}
              onUseScannedCopy={handleUseScannedCopy}
              onCancel={onCancel}
              isEmbedded={true}
              busy={busy || converting}
            />
          )}
        </section>

        {error && (
          <div className="toast">
            <span>{error}</span>
            <button onClick={() => setError('')} title="Dismiss">
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScannerModal;
