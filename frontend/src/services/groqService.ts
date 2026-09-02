import { type UserSession } from '../types/face.types';
import {type  Frame } from '../types/frame.types';
import { inventory } from '../data/inventory';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const getRecommendations = async (session: UserSession): Promise<Frame[]> => {

  const inventoryText = inventory
    .filter(f => f.stock > 0)
    .map(f => `
      ID: ${f.id}
      שם: ${f.name}
      צורה: ${f.shape}
      צבע: ${f.color}
      סגנון: ${f.style}
      מחיר: ${f.price}₪
      מתאים לצורות פנים: ${f.face_shapes_match.join(', ')}
      תיאור: ${f.description}
    `).join('\n---\n');

  const previousFrameText = session.previousFrame
    ? `
      למשתמש יש משקפיים קודמות.
      אהב אותן: ${session.previousFrame.liked ? 'כן' : 'לא'}
      סיבת החלפה: ${session.previousFrame.reason}
    `
    : 'למשתמש אין משקפיים קודמות.';

  const prompt = `
    אתה יועץ משקפיים מקצועי. בחר 3 מסגרות מהמלאי שהכי מתאימות ללקוח.

    נתוני פנים:
    - צורת פנים: ${session.faceData?.faceShape}
    - יחס פנים: ${session.faceData?.ratio}

    העדפות הלקוח:
    - שימוש: ${session.answers.usage}
    - תקציב: ${session.answers.budget}
    - סגנון: ${session.answers.style}

    ${previousFrameText}

    המלאי הזמין:
    ${inventoryText}

    החזר תשובה ב-JSON בלבד, בפורמט הזה בדיוק, ללא טקסט נוסף:
    {
      "recommendations": [
        { "id": "frame_xxx", "reason": "הסבר קצר למה זה מתאים" },
        { "id": "frame_xxx", "reason": "הסבר קצר למה זה מתאים" },
        { "id": "frame_xxx", "reason": "הסבר קצר למה זה מתאים" }
      ]
    }
  `;

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  console.log('תשובה מ-Groq:', data);
  const text = data.choices[0].message.content;
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  return parsed.recommendations
    .map((rec: { id: string; reason: string }) => {
      const frame = inventory.find(f => f.id === rec.id);
      return frame ? { ...frame, reason: rec.reason } : null;
    })
    .filter(Boolean) as Frame[];
};