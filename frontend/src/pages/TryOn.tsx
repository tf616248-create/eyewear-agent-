export default function TryOn({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <main className="screen tryon-screen" dir="rtl">
      <div className="tryon-topline"><button className="text-button" onClick={onBack}>← חזרה להמלצות</button><span className="eyebrow">LIVE FIT</span></div>
      <div className="tryon-heading"><span className="eyebrow">SEE IT ON YOU</span><h2>המסגרת שלך,<br /><em>במציאות.</em></h2><p>החזיקי את המבט במרכז ונראה איך היא יושבת.</p></div>
      <div className="tryon-stage"><div className="lens-mark lens-mark--left" /><div className="lens-mark lens-mark--right" /><span>מצב AR מוכן</span></div>
      <button className="button button--primary button--wide" onClick={onNext}>המשך לצ׳אט <span>↗</span></button>
    </main>
  );
}