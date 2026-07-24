import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, Maximize } from 'lucide-react';

export function InteractiveImageViewer({
  src,
  alt,
  children,
  showRotateControls = true,
}) {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const panRef = useRef(pan);
  panRef.current = pan;

  useEffect(() => {
    if (zoom <= 1.0) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoom]);

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.max(0.5, Math.min(4.0, parseFloat((z * factor).toFixed(2)))));
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const startX = e.clientX - panRef.current.x;
    const startY = e.clientY - panRef.current.y;
    setIsDragging(true);

    const onPointerMove = (moveEvent) => {
      setPan({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY,
      });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  return (
    <div
      className={`interactive-viewer ${isDragging ? 'panning' : ''}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onDoubleClick={resetView}
    >
      <div
        className="viewer-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        <div className="image-relative-container">
          <img src={src} alt={alt} draggable={false} decoding="async" />
          {children}
        </div>
      </div>

      <div className="viewer-toolbar">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))}
          title="Zoom Out"
          type="button"
        >
          <ZoomOut size={16} />
        </button>
        <span className="zoom-value-label">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(4.0, parseFloat((z + 0.25).toFixed(2))))}
          title="Zoom In"
          type="button"
        >
          <ZoomIn size={16} />
        </button>
        {showRotateControls && (
          <>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title="Rotate 90°"
              type="button"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              title="Rotate -90°"
              type="button"
            >
              <RotateCcw size={16} />
            </button>
          </>
        )}
        <button onClick={resetView} title="Fit Document" type="button">
          <Maximize size={16} /> Fit Document
        </button>
        <button onClick={() => setZoom(1.0)} title="100% Actual Size" type="button">
          100%
        </button>
      </div>
    </div>
  );
}
