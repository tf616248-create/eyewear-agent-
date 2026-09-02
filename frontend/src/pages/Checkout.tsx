export default function Checkout({ onReset }: { onReset: () => void }) {
  return (
    <main className="screen checkout-screen" dir="rtl">
      <div className="checkout-mark">✦</div><span className="eyebrow">THE LAST LOOK</span>
      <h2>בחירה יפה<br /><em>מתחילה כאן.</em></h2>
      <p>המסגרת שלך מחכה. תודה שנתת לנו לעזור לך למצוא אותה.</p>
      <button className="button button--primary button--wide" onClick={onReset}>התחל/י מחדש <span>↗</span></button>
    </main>
  );
}