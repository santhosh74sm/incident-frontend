import React, { useState } from 'react';
import { CheckCircle2, Download, ChevronDown, Check } from 'lucide-react';
import { getDownloadUrl } from '../services/scannerApi';

export function FinalStep({
  image,
  originalImage,
  session,
  restart,
  onUseScannedCopy,
  onCancel,
  isEmbedded = false,
  busy,
}) {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  return (
    <div className="center-page final" style={{ maxWidth: isEmbedded ? '800px' : undefined }}>
      <div className="eyebrow-badge">✓ SCAN COMPLETED</div>
      <h1>Your Document is Ready</h1>
      <p className="lede">
        {isEmbedded
          ? 'Review original vs scanned copy and select your preferred document version.'
          : 'Crisp, straightened, high contrast scan ready for instant export.'}
      </p>

      {isEmbedded ? (
        <div style={{ width: '100%', marginBottom: '28px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
              justifyContent: 'center',
            }}
          >
            {/* Original Image Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#9ca3af',
                  marginBottom: '12px',
                }}
              >
                Original Image
              </span>
              <div
                style={{
                  height: '240px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderRadius: '10px',
                  background: '#0f172a',
                }}
              >
                <img
                  src={originalImage || image}
                  alt="Original input file"
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>

            {/* Scanned Image Card */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1.5px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '16px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: '#10b981',
                  marginBottom: '12px',
                }}
              >
                Scanned Image
              </span>
              <div
                style={{
                  height: '240px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderRadius: '10px',
                  background: '#0f172a',
                }}
              >
                <img
                  src={image}
                  alt="Scanned processed document"
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <img className="final-image" src={image} alt="Final processed scan result" />
      )}

      <div className="actions">
        {isEmbedded ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '420px', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                style={{
                  minHeight: '48px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#f3f4f6',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Check size={18} /> Save Original
              </button>

              <button
                type="button"
                onClick={onUseScannedCopy}
                disabled={busy}
                style={{
                  minHeight: '48px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '800',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={18} /> Use Scanned Copy
              </button>
            </div>

            {/* Optional Download Menu */}
            <div style={{ position: 'relative', width: '100%' }}>
              <button
                className="secondary"
                onClick={() => setDownloadMenuOpen((prev) => !prev)}
                disabled={busy}
                type="button"
                style={{
                  width: '100%',
                  minHeight: '42px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Download size={14} /> Download Image <ChevronDown size={14} />
              </button>

              {downloadMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '6px',
                    background: '#1f2937',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    padding: '6px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <a
                    href={getDownloadUrl(session, 'png')}
                    onClick={() => setDownloadMenuOpen(false)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#f3f4f6',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    • Download PNG
                  </a>
                  <a
                    href={getDownloadUrl(session, 'jpg')}
                    onClick={() => setDownloadMenuOpen(false)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#f3f4f6',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    • Download JPG
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {onUseScannedCopy && (
              <button
                className="primary wide-action-button"
                onClick={onUseScannedCopy}
                disabled={busy}
                type="button"
              >
                <CheckCircle2 size={20} /> Use Scanned Copy
              </button>
            )}
            <a className="secondary" href={getDownloadUrl(session, 'png')}>
              <Download size={16} /> Download PNG
            </a>
            <a className="secondary" href={getDownloadUrl(session, 'jpg')}>
              <Download size={16} /> Download JPG
            </a>
            <button className="text-button" onClick={restart} type="button">
              Scan Another Document
            </button>
          </>
        )}
      </div>
    </div>
  );
}
