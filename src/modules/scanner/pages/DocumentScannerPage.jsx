import React from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { useDocumentScanner } from '../hooks/useDocumentScanner';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { CropStep } from '../components/CropStep';
import { CompareStep } from '../components/CompareStep';
import { EnhanceStep } from '../components/EnhanceStep';
import { FinalStep } from '../components/FinalStep';
import { formatApiUrl } from '../services/scannerApi';
import '../styles/scanner.css';

export function DocumentScannerPage() {
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
    handleUpload,
    handleAutoDetect,
    handleCrop,
    handleEnhance,
    restartScanner,
  } = useDocumentScanner();

  const handleFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleUpload(file);
    }
  };

  return (
    <main className="scanner-container">
      <header>
        <div className="brand">
          <span>▣</span> Incident DocScanner <em>v1.0</em>
        </div>
        <div className="secure">
          <div className="secure-badge">
            <div className="secure-dot" /> OPENCV ENGINE READY
          </div>
        </div>
      </header>

      <ProgressIndicator currentStep={step} />

      <section className="scanner-step-wrapper">
        {step === 0 && (
          <div className="hero">
            <div>
              <div className="eyebrow-badge">⚡ AI & OPENCV POWERED</div>
              <h1>
                Turn photos into
                <br />
                <em>crisp document evidence.</em>
              </h1>
              <p className="lede">
                Automatic boundary detection, perspective correction, and smart contrast enhancements powered by high precision computer vision.
              </p>
            </div>
            <div className="drop">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                disabled={busy}
              />
              {busy ? (
                <div className="spinner-box">
                  <div className="spinner" />
                  <p>Analyzing document...</p>
                </div>
              ) : (
                <>
                  <div className="upload-icon">
                    <Upload size={28} />
                  </div>
                  <h2>Upload document scan</h2>
                  <p>Click or drag your document file here</p>
                  <button className="primary" type="button" style={{ pointerEvents: 'none' }}>
                    <ImageIcon size={16} /> Choose Document
                  </button>
                  <div className="format-pills">
                    <span className="format-pill">JPG</span>
                    <span className="format-pill">PNG</span>
                    <span className="format-pill">WEBP</span>
                    <span className="format-pill">BMP</span>
                    <span className="format-pill">TIFF</span>
                  </div>
                </>
              )}
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
            onBack={restartScanner}
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
            session={upload.session_id}
            restart={restartScanner}
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
    </main>
  );
}

export default DocumentScannerPage;
