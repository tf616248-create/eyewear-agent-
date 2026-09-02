import { useState } from 'react';
import { useApp } from '../context/useApp';

interface QuestionsProps {
  onNext: () => void;
}

type Answers = {
  usage: string;
  budget: string;
  style: string;
};

export default function Questions({ onNext }: QuestionsProps) {
  const { setAnswers, setPreviousFrame } = useApp();

  const [answers, setLocalAnswers] = useState<Answers>({
    usage: '',
    budget: '',
    style: '',
  });

  const [hasPrevious, setHasPrevious] = useState<boolean | null>(null);
  const [prevReason, setPrevReason] = useState('');
  const [prevLiked, setPrevLiked] = useState<boolean | null>(null);
  const [prevImage, setPrevImage] = useState<string | null>(null);

  const isComplete =
    answers.usage &&
    answers.budget &&
    answers.style &&
    hasPrevious !== null &&
    (hasPrevious === false || (hasPrevious === true && prevLiked !== null && prevReason));

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPrevImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    setAnswers(answers);
    setPreviousFrame(
      hasPrevious
        ? {
            image: prevImage ?? undefined,
            liked: prevLiked!,
            reason: prevReason,
          }
        : null
    );
    onNext();
  };

  return (
    <main className="screen form-screen" dir="rtl">
      <div className="section-heading"><span className="eyebrow">YOUR TASTE, IN FOCUS</span><h2>כמה שאלות קטנות<br /><em>כדי לדייק בגדול.</em></h2><p>ספרי לנו מה את אוהבת, ואנחנו נמצא את המסגרת שמרגישה טבעית.</p></div>

      <div className="question-block">
        <p><strong>לאיזה שימוש?</strong></p>
        {['יומיום', 'עבודה', 'ספורט', 'אירועים'].map(opt => (
          <button className={`choice ${answers.usage === opt ? 'choice--selected' : ''}`}
            key={opt}
            onClick={() => setLocalAnswers(prev => ({ ...prev, usage: opt }))}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="question-block">
        <p><strong>מה התקציב?</strong></p>
        {['עד 500₪', '500-1000₪', 'גמיש'].map(opt => (
          <button className={`choice ${answers.budget === opt ? 'choice--selected' : ''}`}
            key={opt}
            onClick={() => setLocalAnswers(prev => ({ ...prev, budget: opt }))}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="question-block">
        <p><strong>סגנון מועדף?</strong></p>
        {['קלאסי', 'מודרני', 'נועז', 'לא יודע/ת'].map(opt => (
          <button className={`choice ${answers.style === opt ? 'choice--selected' : ''}`}
            key={opt}
            onClick={() => setLocalAnswers(prev => ({ ...prev, style: opt }))}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="question-block">
        <p><strong>יש לך משקפיים קודמות?</strong></p>
        {[{ label: 'כן', val: true }, { label: 'לא', val: false }].map(opt => (
          <button className={`choice ${hasPrevious === opt.val ? 'choice--selected' : ''}`}
            key={opt.label}
            onClick={() => setHasPrevious(opt.val)}
          >
            {opt.label}
          </button>
        ))}

        {hasPrevious && (
          <div className="previous-branch">
            <p><strong>אהבת אותן?</strong></p>
            {[{ label: 'כן', val: true }, { label: 'לא', val: false }].map(opt => (
              <button className={`choice ${prevLiked === opt.val ? 'choice--selected' : ''}`}
                key={opt.label}
                onClick={() => setPrevLiked(opt.val)}
              >
                {opt.label}
              </button>
            ))}

            <p><strong>למה אתה מחליף?</strong></p>
            <textarea
              value={prevReason}
              onChange={e => setPrevReason(e.target.value)}
              placeholder="למשל: רוצה משהו יותר קל, שבר אותן..."
            />

            <p><strong>תמונה של המשקפיים הישנות (אופציונלי)</strong></p>
            <input className="file-input" type="file" accept="image/*" onChange={handleImageUpload} />
            {prevImage && (
              <img
                src={prevImage}
                alt="משקפיים קודמות"
                className="previous-image"
              />
            )}
          </div>
        )}
      </div>

      <button className="button button--primary button--wide form-submit"
        onClick={handleSubmit}
        disabled={!isComplete}
      >
        בואו נמצא! 🔍
      </button>
    </main>
  );
}