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
      <h1>Adjusted Document</h1>
      <p className="lede">
        Your document has been straightened. Slide to compare original vs cropped document.
      </p>

      <div className="compare-toggle-bar">
        <button
          className={viewMode === 'slider' ? 'active' : ''}
          onClick={() => setViewMode('slider')}
          type="button"
        >
          <Sliders size={16} /> Split View
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
            <img className="split-fg" src={corrected} alt="Cropped document scan" />
          </div>

          <div className="split-divider" style={{ left: `${splitPos}%` }}>
            <div className="split-handle">↔</div>
          </div>

          <span className="badge badge-left">Original</span>
          <span className="badge badge-right">Cropped</span>
        </div>
      ) : (
        <div className="comparison">
          <figure>
            <img src={original} alt="Original document input" />
            <figcaption>Original Document</figcaption>
          </figure>
          <div className="arrow">→</div>
          <figure>
            <img src={corrected} alt="Cropped document scan" />
            <figcaption>Cropped Document</figcaption>
          </figure>
        </div>
      )}

      <div className="actions">
        <button className="secondary" onClick={onBack} type="button">
          Back: Adjust Corners
        </button>
        <button className="primary" onClick={onNext} type="button">
          Next: Improve Document <Check size={16} />
        </button>
      </div>
    </div>
  );
}
