import React, { useState } from 'react';

export function CropOverlay({
  points = [],
  naturalWidth,
  naturalHeight,
  setPoints,
}) {
  const [activeCorner, setActiveCorner] = useState(-1);

  const handleCornerPointerDown = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveCorner(index);

    const container = e.currentTarget.closest('.image-relative-container');
    if (!container) return;

    const handlePointerMove = (moveEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      let relX = (moveEvent.clientX - rect.left) / rect.width;
      let relY = (moveEvent.clientY - rect.top) / rect.height;

      relX = Math.max(0, Math.min(1, relX));
      relY = Math.max(0, Math.min(1, relY));

      const realX = Math.round(relX * naturalWidth);
      const realY = Math.round(relY * naturalHeight);

      const newPoints = [...points];
      newPoints[index] = [realX, realY];
      setPoints(newPoints);
    };

    const handlePointerUp = () => {
      setActiveCorner(-1);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const normalizedPoints = points.map(([x, y]) => [
    x / (naturalWidth || 1),
    y / (naturalHeight || 1),
  ]);

  const polygonPointsStr = normalizedPoints.map((p) => `${p[0]},${p[1]}`).join(' ');

  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="crop-svg-overlay"
      style={{ pointerEvents: 'none' }}
    >
      <polygon
        points={polygonPointsStr}
        className="crop-polygon"
        style={{ pointerEvents: 'none' }}
      />
      {normalizedPoints.map((p, i) => (
        <g key={i} style={{ pointerEvents: 'none' }}>
          <circle
            cx={p[0]}
            cy={p[1]}
            r={0.045}
            fill="transparent"
            style={{ cursor: 'grab', pointerEvents: 'auto' }}
            onPointerDown={(e) => handleCornerPointerDown(i, e)}
            aria-label={`Crop Corner ${i + 1}`}
          />
          <circle
            cx={p[0]}
            cy={p[1]}
            r={0.022}
            className={`crop-handle ${activeCorner === i ? 'dragging' : ''}`}
            style={{ pointerEvents: 'auto' }}
            onPointerDown={(e) => handleCornerPointerDown(i, e)}
          />
        </g>
      ))}
    </svg>
  );
}
