import json
import os
import re
import httpx
import asyncio
import logging
from dotenv import load_dotenv
from prompts.prompt_builder import build_chat_prompt

# הגדרת לוגר לניטור תקלות
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

# זיכרון שיחות — session_id → היסטוריה
_chat_sessions: dict[str, list] = {}


def _merge_recommendation_reasons(
    ranked_frames: list[dict],
    previous_recommendations: object,
) -> list[dict]:
    """Keep the reasons shown in the UI when recommendations are re-ranked."""
    reasons_by_id = {
        str(frame.get('id')): frame.get('reason', '')
        for frame in previous_recommendations or []
        if isinstance(frame, dict) and frame.get('id') is not None
    } if isinstance(previous_recommendations, list) else {}

    return [
        {
            **frame,
            'reason': frame.get('reason') or reasons_by_id.get(str(frame.get('id')), ''),
        }
        for frame in ranked_frames
    ]


def _recommendation_history_entry(recommendations: list[dict]) -> str:
    """Store the exact recommendation explanations shown to the customer."""
    items = []
    for frame in recommendations:
        items.append(
            f"- ID: {frame.get('id', 'unknown')}; "
            f"Name: {frame.get('name', 'unknown')}; "
            f"Reason shown: {frame.get('reason', '')}"
        )
    return "Recommendation details shown to the customer:\n" + "\n".join(items)


def extract_preferences(message: str) -> dict:
    """Extract only preferences explicitly stated in the user's message."""
    preferences = {}
    normalized = message.strip().lower()

    style_values = ('קלאסי', 'מקצועי-מינימליסטי', 'וינטאג׳', 'אלגנטי', 'נועז-מודרני', 'מודרני', 'מינימליסטי', 'קז׳ואל', 'רטרו')
    usage_values = ('יום יום', 'עבודה', 'אירועים', 'יציאות')
    for value in style_values:
        if value in message:
            preferences['style'] = value
            break
    for value in usage_values:
        if value in message:
            preferences['usage'] = value
            break

    budget_match = re.search(r'(?:תקציב|עד|במחיר של)\s*(?:של\s*)?(\d+(?:[.,]\d+)?)', message)
    if budget_match:
        preferences['budget'] = f"עד {budget_match.group(1)}"
    elif 'גמיש' in normalized:
        preferences['budget'] = 'גמיש'

    if 'יוניסקס' in normalized or 'לשני המינים' in normalized:
        preferences['gender'] = 'יוניסקס'
    elif 'אישה' in normalized or 'נשי' in normalized or 'לנשים' in normalized:
        preferences['gender'] = 'אישה'
    elif 'גבר' in normalized or 'גברי' in normalized or 'לגברים' in normalized:
        preferences['gender'] = 'גבר'

    return preferences


def get_or_create_session(session_id: str) -> list:
    """מחזיר היסטוריית שיחה קיימת או יוצר חדשה"""
    if session_id not in _chat_sessions:
        _chat_sessions[session_id] = []
        print(f"🆕 Created new session: {session_id}")
    else:
        print(f"♻️  Reusing existing session: {session_id} ({len(_chat_sessions[session_id])} messages)")
    return _chat_sessions[session_id]


def clear_session(session_id: str):
    """מאפס שיחה — לשימוש בסוף סשן"""
    if session_id in _chat_sessions:
        del _chat_sessions[session_id]


async def chat(
    session_id: str,
    user_message: str,
    session: dict,
    rejected_ids: list[str],
    displayed_ids: list[str]
) -> dict:
    """
    Workflow של צ'אט:
    1. טעינת היסטוריה
    2. בניית prompt
    3. קריאה ל-Gemini (עם מנגנון Retry)
    4. שמירת היסטוריה
    5. החזרת תשובה
    """

    # שלב 1 — טעינת היסטוריה ועדכון העדפות שנאמרו במפורש
    history = get_or_create_session(session_id)
    round_count = len([m for m in history if m['role'] == 'user'])
    extracted_preferences = extract_preferences(user_message)
    updated_session = {**session, 'answers': {
        **session.get('answers', {}),
        **extracted_preferences,
    }, 'rejectedFrameIds': rejected_ids, 'displayedFrameIds': displayed_ids}
    from workflow.recommendation_chain import get_ranked_frames
    ranked_recommendations = get_ranked_frames(updated_session)
    updated_recommendations = _merge_recommendation_reasons(
        ranked_recommendations[:3],
        session.get('recommendations', []),
    )
    logger.info(
        "Chat recommendation filtering: %d ranked frames before, %d frames sent after filtering",
        len(ranked_recommendations),
        len(updated_recommendations),
    )

    print(f"💬 Chat round {round_count + 1} for session {session_id}")

    # שלב 2 — בדיקת מספר סיבובים
    clarifying_note = ""
    if round_count >= 4:
        clarifying_note = """
IMPORTANT: The customer has been chatting for more than 4 rounds without deciding.
Ask one clarifying question to help them decide. Keep it short and friendly.
        """

    # שלב 3 — בניית prompt
    prompt = build_chat_prompt(
        user_message=user_message,
        session={**updated_session, 'recommendations': updated_recommendations},
        chat_history=history,
        rejected_ids=rejected_ids
    )

    if clarifying_note:
        prompt += f"\n\n{clarifying_note}"

    # שלב 4 — קריאה ל-Gemini עם מנגנון Retry
    max_retries = 3
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 13000
        }
    }

    reply = ""
    finish_reason = None
    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt in range(max_retries):
            try:
                response = await client.post(GEMINI_URL, json=payload)
                
                # טיפול ב-503 (עומס) באמצעות המתנה מעריכית
                if response.status_code == 503 and attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(f"Gemini busy (503), retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                
                response.raise_for_status()
                data = response.json()
                candidate = data.get("candidates", [{}])[0]
                finish_reason = candidate.get("finishReason")
                logger.info("Gemini raw response: %s", response.text)
                logger.info(
                    "Gemini response diagnostics: finish_reason=%s, max_output_tokens=%s",
                    finish_reason,
                    payload["generationConfig"]["maxOutputTokens"],
                )
                if finish_reason == "MAX_TOKENS":
                    logger.warning("Gemini response was truncated because it reached maxOutputTokens")

                reply = candidate["content"]["parts"][0]["text"].strip()
                break # הצלחה, יציאה מהלולאה
                
            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"Final attempt failed: {str(e)}")
                    raise Exception(f"Gemini error: {str(e)}")
                await asyncio.sleep(1)

    # שלב 5 — שמירת היסטוריה
    history.append({"role": "user", "content": user_message})
    history.append({"role": "agent", "content": reply})
    history.append({
        "role": "agent",
        "content": _recommendation_history_entry(updated_recommendations),
    })

    print(f"✅ Chat reply: {reply[:50]}...")

    return {
        "reply": reply,
        "finishReason": finish_reason,
        "recommendations": updated_recommendations,
        "answers": updated_session['answers'],
        "roundCount": round_count + 1,
        "sessionId": session_id
    }