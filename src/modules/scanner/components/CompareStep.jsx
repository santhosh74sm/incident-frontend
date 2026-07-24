import React, { useState, useRef } from 'react';
import { Sliders, Columns, Check } from 'lucide-react';

export function CompareStep({
  original,
  corrected,
  onBack,
  onNext,
}) {
  const [viewMode, setViewMode] = useState('slider');
  const [splitPos, setSplitPos] = useState(50);
  const [isSliding, setIsSliding] = useState(false);
  const sliderRef = useRef(null);

  const handleSliderMove = (clientX) => {
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      setSplitPos(pct);
    }
  };

  return (
    <div className="center-page">
      <p className="eyebrow">STEP 3 OF 5</p>
      <h1>Perspective Correction Result</h1>
      <p className="lede">
        Your document has been flattened and rectified. Slide to compare original photo vs scan.
      </p>

      <div className="compare-toggle-bar">
        <button
          className={viewMode === 'slider' ? 'active' : ''}
          onClick={() => setViewMode('slider')}
          type="button"
        >
          <Sliders size={16} /> Split Slider
        </button>
        <button
          className={viewMode === 'side' ? 'active' : ''}
          onClick={() => setViewMode('side')}
          type="button"
        >
          <Columns size={16} /> Side by Side
        </button>
      </div>

      {viewMode === 'slider' ? (
        <div
          ref={sliderRef}
          className="split-comparison"
          onPointerDown={(e) => {
            setIsSliding(true);
            handleSliderMove(e.clientX);
          }}
          onPointerMove={(e) => isSliding && handleSliderMove(e.clientX)}
          onPointerUp={() => setIsSliding(false)}
          onPointerLeave={() => setIsSliding(false)}
        >
          <img className="split-bg" src={original} alt="Original document input" />
          <div
            className="split-fg-wrapper"
            style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
          >
            <img className="split-fg" src={corrected} alt="Rectified perspective scan" />
          </div>

          <div className="split-divider" style={{ left: `${splitPos}%` }}>
            <div className="split-handle">↔</div>
          </div>

          <span className="badge badge-left">Original</span>
          <span className="badge badge-right">Rectified</span>
        </div>
      ) : (
        <div className="comparison">
          <figure>
            <img src={original} alt="Original document input" />
            <figcaption>Original Photo</figcaption>
          </figure>
          <div className="arrow">→</div>
          <figure>
            <img src={corrected} alt="Rectified perspective scan" />
            <figcaption>Rectified Scan</figcaption>
          </figure>
        </div>
      )}

      <div className="actions">
        <button className="secondary" onClick={onBack} type="button">
          Adjust Crop Corners
        </button>
        <button className="primary" onClick={onNext} type="button">
          Choose Image Filter <Check size={16} />
        </button>
      </div>
    </div>
  );
}
