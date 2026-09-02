import { useState, useEffect } from 'react';
import { type Frame } from '../types/frame.types';
import { tryOnWithMediaPipe } from '../services/mediaPipeService';

export default function TryOnCard({ frame, explanation, faceImageDataUrl, onSelect, selected }: { frame: Frame; explanation: string; faceImageDataUrl: string | null; onSelect: (id: string) => void; selected: boolean }) {
  const [tryOnImage, setTryOnImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const resolvedFrontImage = frame.image?.trim() || null;
  console.log("תמונת המשקפיים:", resolvedFrontImage);
  useEffect(() => {
    if (tryOnImage || loading || error) return;

    if (!resolvedFrontImage) {
      setError(true);
      return;
    }

    if (!faceImageDataUrl) return;

    const runTryOn = async () => {
      setLoading(true);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('טעינת תמונת הפנים נכשלה'));
          img.src = faceImageDataUrl;
        });
        const result = await tryOnWithMediaPipe(img, resolvedFrontImage, frame.id);
        if (!result) {
          setError(true);
          return;
        }
        setTryOnImage(result);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    runTryOn();
  }, [faceImageDataUrl, tryOnImage, loading, error, resolvedFrontImage, frame.id]); // תלויות מלאות
  
  return (
    <div className={`frame-card ${selected ? 'frame-card--selected' : ''}`}
      onClick={() => onSelect(frame.id)}
    >
      <div className="frame-card__image">
        {loading && <div className="frame-card__loading">מעבד...</div>}
        
        {resolvedFrontImage ? (
          <img 
            src={(!error && tryOnImage) || resolvedFrontImage} 
            alt={frame.name} 
            className="frame-card__photo"
            onError={() => setError(true)}
          />
        ) : (
          <div style={{ padding: 16, color: '#64748b' }}>תמונת המסגרת אינה זמינה</div>
        )}
      </div>

      <div className="frame-card__body">
        <h3>{frame.name}</h3>
        <p>{explanation}</p>
        
        <div className="frame-card__meta">
          <span style={{ fontWeight: 700 }}>₪{frame.price}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); onSelect(frame.id); }}
          >
            {selected ? 'נבחר' : 'בחר'}
          </button>
        </div>
      </div>
    </div>
  );
}