import React from 'react';
import { Download } from 'lucide-react';
import { getDownloadUrl } from '../services/scannerApi';

export function FinalStep({
  image,
  session,
  restart,
}) {
  return (
    <div className="center-page final">
      <div className="eyebrow-badge">✓ SCAN COMPLETED</div>
      <h1>Your Document is Ready</h1>
      <p className="lede">Crisp, straightened, high contrast scan ready for instant export.</p>
      <img className="final-image" src={image} alt="Final processed scan result" />
      <div className="actions">
        <a className="primary" href={getDownloadUrl(session, 'png')}>
          <Download size={16} /> Download PNG
        </a>
        <a className="secondary" href={getDownloadUrl(session, 'jpg')}>
          <Download size={16} /> Download JPG
        </a>
        <button className="text-button" onClick={restart} type="button">
          Scan Another Document
        </button>
      </div>
    </div>
  );
}
