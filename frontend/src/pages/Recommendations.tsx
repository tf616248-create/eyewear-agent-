import { useEffect, useState } from 'react';
import { useApp } from '../context/useApp';
import { getRecommendations } from '../services/apiService';
import { type FrameWithReason } from '../context/appContextTypes';
import TryOnCard from '../components/TryOnCard';

interface RecommendationsProps {
  onNext: () => void;
  onChat: () => void;
}

export default function Recommendations({ onNext, onChat }: RecommendationsProps) {
  const { session, setRecommendations, setSelectedFrame, recommendations, agentState, displayedFrameIds } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchRecommendations = async () => {
      setError(null);
      try {
        if (!session.faceData) {
          throw new Error('אין נתוני פנים תקינים לבקשה');
        }

        setLoading(true);
        const responseData = await getRecommendations({
          faceData: session.faceData,
          answers: session.answers,
          previousFrame: session.previousFrame,
          rejectedFrameIds: agentState.rejectedFrameIds,
          displayedFrameIds,
        });
        
        // --- תיקון מנגנון חילוץ והגנת המערך ---
        let finalFrames: FrameWithReason[] = [];
        
        if (responseData && responseData.recommendations && Array.isArray(responseData.recommendations)) {
          // מקרה בו ה-Backend מחזיר אובייקט עטוף: { recommendations: [...] }
          finalFrames = responseData.recommendations;
        } else if (Array.isArray(responseData)) {
          // מקרה בו ה-Backend מחזיר מערך נקי ישירות: [...]
          finalFrames = responseData;
        } else {
          console.error('Unexpected data structure from API:', responseData);
          throw new Error('מבנה הנתונים שהתקבל מהשרת אינו תקין');
        }

        setRecommendations(finalFrames);
      } catch (err) {
        console.error(err);
        setError('משהו השתבש, נסי שוב');
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!recommendations || recommendations.length === 0) {
      fetchRecommendations();
    } else {
      setLoading(false);
    }
  }, []);

  const handleSelect = (id: string) => {
    setSelected(id);
    setSelectedFrame(id);
  };

  if (loading) return (
    <main className="screen status-screen" dir="rtl">
      <div className="loader-ring">◌</div><p>מחפש את המסגרות המושלמות עבורך...</p>
    </main>
  );

  if (error) return (
    <main className="screen status-screen" dir="rtl">
      <p>{error}</p>
      <button className="button button--primary" onClick={() => window.location.reload()}>נסי שוב</button>
    </main>
  );

  return (
    <main className="screen recommendations-screen" dir="rtl">
      <div className="section-heading"><span className="eyebrow">A CURATED SHORTLIST</span><h2>מצאתי לך<br /><em>מסגרות מושלמות.</em></h2><p>שלוש בחירות שנבחרו לפי הפנים, הסגנון והקצב שלך.</p></div>

      <div className="frame-list">
        {/* הגנה נוספת בשכבת הרינדור לוודא שקיים מערך תקני */}
        {Array.isArray(recommendations) && recommendations.length > 0 ? (
          recommendations.map((frame: FrameWithReason) => (
            <TryOnCard
              key={frame.id}
              frame={frame}
              explanation={frame.reason}
              faceImageDataUrl={session.faceData?.capturedImage || null}
              onSelect={handleSelect}
              selected={selected === frame.id}
            />
          ))
        ) : (
          <p style={{ textAlign: 'center' }}>לא נמצאו המלצות מתאימות במלאי.</p>
        )}
      </div>

      <div className="action-stack">
        <button
          onClick={onNext}
          disabled={!selected}
        >
          נסי AR חי 🎥
        </button>

        <button
          onClick={onChat}
        >
          רוצה לשוחח עם היועץ 💬
        </button>

        <button
          onClick={fetchRecommendations}
          disabled={loading}
        >
          הצעות נוספות
        </button>
      </div>
    </main>
  );
}