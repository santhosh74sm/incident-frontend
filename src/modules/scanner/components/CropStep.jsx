import React from 'react';
import { ArrowLeft, RefreshCw, Check } from 'lucide-react';
import { InteractiveImageViewer } from './InteractiveImageViewer';
import { CropOverlay } from './CropOverlay';

export function CropStep({
  image,
  corners,
  imageWidth,
  imageHeight,
  onChange,
  onNext,
  onBack,
  onAuto,
  busy,
}) {
  return (
    <div className="workspace">
      <aside>
        <button className="back" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Choose Different Image
        </button>
        <p className="eyebrow">STEP 2 OF 5</p>
        <h1>Adjust Crop Corners</h1>
        <p>
          Drag corner markers to paper edges. Drag background to pan, or use mouse wheel to zoom.
        </p>

        <div className="button-group">
          <button className="secondary" onClick={onAuto} disabled={busy} type="button">
            <RefreshCw size={16} /> Auto Detect
          </button>
          <button className="primary wide" disabled={busy} onClick={onNext} type="button">
            Perspective Crop <Check size={16} />
          </button>
        </div>
      </aside>

      <div className="preview-card">
        <InteractiveImageViewer src={image} alt="Document crop source" showRotateControls={true}>
          <CropOverlay
            points={corners}
            naturalWidth={imageWidth}
            naturalHeight={imageHeight}
            setPoints={onChange}
          />
        </InteractiveImageViewer>
      </div>
    </div>
  );
}
