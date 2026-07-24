import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { ENHANCEMENT_MODES } from '../utils/constants';
import { InteractiveImageViewer } from './InteractiveImageViewer';

export function EnhanceStep({
  image,
  mode,
  setMode,
  onEnhance,
  busy,
  onBack,
  onNext,
}) {
  return (
    <div className="workspace enhance">
      <aside>
        <button className="back" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Back
        </button>
        <p className="eyebrow">STEP 4 OF 5</p>
        <h1>Improve Document</h1>
        <p>Select a document style to make text clear and easy to read.</p>
        <div className="modes">
          {ENHANCEMENT_MODES.map(([id, label]) => (
            <button
              className={mode === id ? 'selected' : ''}
              key={id}
              disabled={busy}
              onClick={() => {
                setMode(id);
                onEnhance(id);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <button className="primary wide" onClick={onNext} disabled={!image || busy} type="button">
          Finish <Check size={16} />
        </button>
      </aside>

      <div className="preview-card">
        {busy ? (
          <div className="spinner-box">
            <div className="spinner" />
            <p>Improving document...</p>
          </div>
        ) : (
          <InteractiveImageViewer src={image} alt="Improved document preview" showRotateControls={true} />
        )}
      </div>
    </div>
  );
}
