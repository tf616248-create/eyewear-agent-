import json
import os
import re
import httpx
from dotenv import load_dotenv
import asyncio
import traceback

# ייבוא שירותים שאינם גורמים ללולאה מעגלית
from workflow.reranking_service import rerank_frames
from prompts.prompt_builder import build_recommendation_prompt

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"


def get_ranked_frames(session: dict) -> list[dict]:
    """Run the production embedding and reranking stages without Gemini."""
    from workflow.embedding_service import find_similar_frames

    rejected_ids = session.get('rejectedFrameIds', [])
    displayed_ids = session.get('displayedFrameIds', [])
    excluded_ids = list(dict.fromkeys([*rejected_ids, *displayed_ids]))
    similar_frames = find_similar_frames(session, top_k=6)
    return rerank_frames(similar_frames, session, excluded_ids)


async def get_recommendations(session: dict) -> list[dict]:
    """
    Workflow מלא:
    1. Embedding — מוצא 6 מסגרות רלוונטיות
    2. Re-Ranking — מדרג לפי תקציב, סגנון, צורת פנים
    3. Gemini — יוצר נימוק טקסטואלי לכל מסגרת מובילה
    """
    # שלב 1 — Embedding
    print("🔍 Step 1: Finding similar frames with Embedding...")
    try:
        ranked_frames = get_ranked_frames(session)
        print(f"   Found {len(ranked_frames)} relevant frames")
    except Exception as e:
        import traceback
        print("❌ הקריסה התרחשה בשלב האמבדינגס! הנה פירוט השגיאה המלאה:")
        traceback.print_exc()
        raise e

    # שלב 2 — Re-Ranking
    print("📊 Step 2: Re-ranking frames...")
    print(f"   Top frames after ranking: {[f['id'] for f in ranked_frames[:6]]}")

    # שלב 3 — בניית Prompt
    print("📝 Step 3: Building prompt...")
    top_frames = ranked_frames[:3]
    prompt = build_recommendation_prompt(session, top_frames)

    print("🤖 Step 4: Calling Gemini...")
    
    # הגדרת משתני לולאת הניסיונות
    # טיימאאוט מצומצם ופחות ניסיונות: דירוג המסגרות (Embedding) כבר עובד בלי
    # Gemini, ש-Gemini מוסיף זה רק את הנימוק הטקסטואלי. אם הוא איטי/לא מגיב,
    # מוטב להחזיר תוך זמן סביר עם נימוק גנרי מאשר "להיתלות" עד שהפרוקסי
    # (לדוגמה ב-Render) מחליט שהבקשה תקועה ומחזיר 502 לדפדפן.
    max_retries = 2
    attempt = 0
    success = False
    data = None
    last_exception = None

    while attempt < max_retries and not success:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=25.0) as client:
                response = await client.post(
                    GEMINI_URL,
                    json={
                        "contents": [{
                            "parts": [{"text": prompt}]
                        }]
                    }
                )
                
                # בדיקת תקינות התגובה
                if response.status_code == 200:
                    data = response.json()
                    success = True
                elif response.status_code in [500, 503]:
                    attempt += 1
                    print(f"⚠️ ניסיון {attempt} נכשל ({response.status_code}). ממתין 2 שניות...")
                    if attempt < max_retries:
                        await asyncio.sleep(2)
                else:
                    # לשגיאות קבועות (כמו 400), נבצע raise מיד
                    response.raise_for_status()

        except Exception as e:
            attempt += 1
            last_exception = e
            print(f"❌ ניסיון {attempt} נכשל עקב שגיאה: {e}")
            if attempt < max_retries:
                await asyncio.sleep(2)
            else:
                # לא מפילים את כל הבקשה אם Gemini לא עונה בזמן - ממשיכים
                # לשלב הפענוח עם data=None, שיגרום לכל המסגרות לקבל את
                # fallback_reason במקום לקרוס/להיתקע.
                print(f"⚠️ כל הניסיונות ל-Gemini נכשלו ({last_exception}). ממשיכים עם נימוק גנרי.")

  
    # שלב 5 — פענוח בטוח של תשובת ה-JSON
    print("✅ Step 5: Parsing response...")
    reason_by_id = {}
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        match = re.search(r'\[.*\]|\{.*\}', text, re.DOTALL)
        clean_json = match.group(0) if match else text
        parsed = json.loads(clean_json)
        reasons = parsed.get("reasons", []) if isinstance(parsed, dict) else parsed
        if isinstance(reasons, list):
            reason_by_id = {
                str(item["id"]): item["reason"]
                for item in reasons
                if isinstance(item, dict)
                and item.get("id") is not None
                and isinstance(item.get("reason"), str)
                and item["reason"].strip()
            }
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        print(f"⚠️ Warning: Could not parse Gemini reasons: {exc}")

    # שלב 6 — בניית התוצאה לפי סדר ה-reranking בלבד
    print("🎉 Step 6: Building final structured result...")

    fallback_reason = "מסגרת זו נבחרה עבורך על סמך שילוב צורת הפנים, העדפות הסגנון והתקציב שהגדרת."
    result = [
        {
            **frame,
            "reason": reason_by_id.get(str(frame["id"]), fallback_reason),
        }
        for frame in top_frames
    ]

    print(f"🎉 Done! Returning {len(result)} recommendations to client")
    return result