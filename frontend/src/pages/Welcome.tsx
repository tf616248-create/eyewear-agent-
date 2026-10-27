import { useRef, useState, useEffect } from 'react';
import { useApp } from '../context/useApp';
import { analyzeFaceFromVideo } from '../services/mediaPipeService';

interface WelcomeProps {
  onNext: () => void;
}

export default function Welcome({ onNext }: WelcomeProps) {
  const { setFaceData } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      console.error('שגיאה בגישה למצלמה:', err);
      const message =
        err instanceof DOMException && err.name === 'NotReadableError'
          ? 'המצלמה תפוסה על ידי אפליקציה או טאב אחר. סגרי אותם ונסי שוב.'
          : err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'הגישה למצלמה נחסמה. אפשרי גישה בהגדרות הדפדפן ונסי שוב.'
          : 'לא הצלחנו לגשת למצלמה. נסי שוב.';
      setCameraError(message);
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
  }, [stream, cameraActive]);

  // Release the camera on unmount (and before the effect above re-runs)
  // so a hot-reload or navigating away doesn't leave the device locked.
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const handleScan = async () => {
    if (!videoRef.current) return;
    setScanning(true);

    try {
      // 1. צילום ה-Snapshot מהוידאו
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const capturedImage = canvas.toDataURL('image/png');

      // 2. ניתוח הפנים דרך MediaPipe
      const faceData = await analyzeFaceFromVideo(videoRef.current);
      
      // 3. עדכון ה-AppContext עם הנתונים ותמונת ה-Snapshot
      setFaceData({
        ...faceData,
        capturedImage: capturedImage
      });
      
      onNext();
    } catch (err) {
      console.error('שגיאה בסריקה:', err);
      // שימוש ב-Mock במקרה של תקלה טכנית
      setFaceData({
        faceShape: 'אובלי',
        faceWidth: 140,
        faceHeight: 180,
        ratio: 0.78,
        capturedImage: null
      });
      onNext();
    } finally {
      setScanning(false);
    }
  };

  return (
    <main className="screen welcome-screen" dir="rtl">
      <div className="welcome-copy">
        <span className="eyebrow">EYNAYICH / OPTICAL EDIT</span>
        <h1>המסגרת שנועדה<br /><em>לך.</em></h1>
        <p className="lead">היועץ האישי שלך למשקפיים, עם עין חדה לפרטים הקטנים.</p>
      </div>

      <div className="camera-stage">
        <div className="camera-corner camera-corner--tl" />
        <div className="camera-corner camera-corner--br" />
        {cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div className="camera-placeholder"><span>◌</span><small>המצלמה תעזור לנו לדייק</small></div>
        )}
      </div>

      {!cameraActive && (
        <button className="button button--primary button--wide" onClick={startCamera}>התחל/י עכשיו <span>↗</span></button>
      )}

      {cameraError && <p className="camera-error-note">{cameraError}</p>}

      {cameraActive && !scanning && (
        <button className="button button--primary button--wide" onClick={handleScan}>סרוק את הפנים שלי <span>✦</span></button>
      )}

      {scanning && <p className="loading-note"><span className="pulse-dot" /> סורק...</p>}

      <p className="privacy-note">
        <span>⌁</span> התמונה נשמרת אצלך בלבד
      </p>
    </main>
  );
}