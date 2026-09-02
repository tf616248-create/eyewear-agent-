import { faceApiTryOn } from './faceApiService';

export interface TryOnResult {
  imageDataUrl: string;
}

/**
 * מבצע מיזוג משקפיים על תמונת פנים.
 * כולל הגנה מפני קריאות כושלות וטיפול בשגיאות רשת.
 */
export async function applyGlassesOnPhoto(
  faceImageDataUrl: string,
  glassesImageUrl: string
): Promise<TryOnResult | null> {
  // 1. הגנת קלט: ודאי שהנתונים קיימים לפני שליחה
  if (!faceImageDataUrl || !glassesImageUrl) {
    console.warn("TryOnService: חסרים נתונים למיזוג");
    return null;
  }

  try {
    console.log("TryOnService: פונה לשירות המיזוג...");
    
    // 2. קריאה לשירות עם פוטנציאל לטיפול בזמנים (Timeout במידת הצורך)
    const result = await faceApiTryOn(faceImageDataUrl, glassesImageUrl);

    // 3. ודוא שקיבלנו תשובה תקינה
    if (result && result.imageDataUrl) {
      return result;
    }

    console.error("TryOnService: השירות החזיר תוצאה ריקה");
    return null;

  } catch (error) {
    // 4. רישום שגיאה מפורט לצרכי דיבאג
    console.error("TryOnService: כשל בביצוע המיזוג:", error);
    
    // החזרת null כדי שהקומפוננטה תדע להציג Fallback
    return null;
  }
}