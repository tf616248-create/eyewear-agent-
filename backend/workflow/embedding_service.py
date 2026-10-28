import json
import numpy as np
from pathlib import Path

# 1. טעינת המודל והטוקנייזר — פעם אחת בלבד בהפעלת השרת.
# מזהה המודל ב-Hugging Face Hub (ולא נתיב מקומי): כך הקוד עובד בכל סביבה
# (כולל שרת בענן כמו Render), ו-transformers מוריד ושומר אותו במטמון מקומי
# (~90MB) באופן אוטומטי בהפעלה הראשונה.
MODEL_PATH = "sentence-transformers/all-MiniLM-L6-v2"

# טוענים את המודל רק בפעם הראשונה שבאמת צריך אותו (לא בזמן import), כדי
# שהשרת יספיק לפתוח את הפורט מהר ולעבור את בדיקת ה-port scan של Render —
# הורדת/טעינת המודל יכולה לקחת יותר מהטיימאאוט אם היא קורית לפני bind הפורט.
_tokenizer = None
_model = None

def _get_model():
    global _tokenizer, _model
    if _tokenizer is None:
        # ה-import של transformers (ושל torch, בתוך get_embeddings_batch) קורה
        # כאן ולא בראש הקובץ בכוונה: זו ספרייה כבדה, וה-import עצמו (לא רק
        # הורדת המודל) לוקח זמן לא מבוטל על מעבד חלש/משותף כמו ב-Render. אם
        # זה היה בראש הקובץ, הוא היה רץ עוד לפני ש-uvicorn מספיק לפתוח פורט,
        # וגורם ל-"Port scan timeout" בדיוק כמו עם טעינת המודל עצמה.
        from transformers import AutoTokenizer, AutoModel
        print("🔄 טוען מודל אמבדינגס...")
        try:
            # אם המודל כבר במטמון המקומי (למשל כי scripts/warm_model_cache.py
            # רץ בזמן ה-build), נטען אותו בלי לפנות לרשת בכלל - ה-from_pretrained
            # הרגיל שולח כמה קריאות HEAD ל-Hugging Face Hub כדי לבדוק גרסה,
            # וזה יכול לקחת הרבה זמן על רשת איטית/מוגבלת ולגרום ל-timeout.
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
            _model = AutoModel.from_pretrained(MODEL_PATH, local_files_only=True)
        except OSError:
            # אין עדיין מטמון מקומי (למשל ריצה ראשונה על מחשב חדש) - מורידים.
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            _model = AutoModel.from_pretrained(MODEL_PATH)
        print("✅ המודל נטען בהצלחה!")
    return _tokenizer, _model

def get_embeddings_batch(texts: list[str]) -> list[np.ndarray]:
    """מפיק embeddings למספר טקסטים במכה אחת (batch) - קריאה בודדת למודל
    במקום קריאה נפרדת לכל טקסט, מה שהופך בניית אינדקס של מאות מסגרות
    להרבה יותר מהירה (חשוב כדי לא להיתקע על timeout בבקשה הראשונה בפריסה)."""
    import torch
    tokenizer, model = _get_model()
    inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
        outputs = model(**inputs)

    # ביצוע Mean Pooling (ממוצע הוקטורים) לקבלת וקטור יחיד שמייצג כל משפט
    attention_mask = inputs['attention_mask']
    token_embeddings = outputs.last_hidden_state
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    embeddings = (sum_embeddings / sum_mask).numpy()

    # נרמול כל הווקטורים (שקול ל-normalize_embeddings=True)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return list(embeddings / norms)

def get_embedding(text: str) -> np.ndarray:
    """פונקציית עזר להפקת Embedding מתוך טקסט בודד"""
    return get_embeddings_batch([text])[0]

# טעינת המלאי — נתיב יחסי לקובץ הזה, כדי שיעבוד בכל מחשב/שרת
INVENTORY_PATH = Path(__file__).resolve().parent.parent / "data" / "eyewear_inventory.json"

def load_inventory() -> list:
    with open(INVENTORY_PATH, encoding='utf-8') as f:
        return json.load(f)

def frame_to_text(frame: dict) -> str:
    """ממיר את השדות התיאוריים הקיימים במלאי לטקסט לצורך Embedding."""
    return (
        f"shape: {frame.get('shape', '')} "
        f"frame: {frame.get('frame', '')} "
        f"style: {frame.get('style', '')} "
        f"description: {frame.get('description_he', frame.get('description', ''))}"
    )

def session_to_text(session: dict) -> str:
    """ממיר נתוני לקוח לטקסט לצורך Embedding"""
    face_data = session.get('faceData', {})
    answers = session.get('answers', {})
    previous = session.get('previousFrame')

    text = (
        f"face shape: {face_data.get('faceShape', '')} "
        f"usage: {answers.get('usage', '')} "
        f"style: {answers.get('style', '')} "
        f"budget: {answers.get('budget', '')} "
    )

    if answers.get('gender'):
        text += f"gender: {answers['gender']} "

    if previous:
        liked = "liked" if previous.get('liked') else "did not like"
        text += f"previous glasses: {liked}, reason: {previous.get('reason', '')}"

    return text

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """חישוב דמיון בין שני ווקטורים"""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

# קובץ embeddings מוכן מראש (ראו scripts/precompute_embeddings.py) - חוסך
# את הצורך להריץ את המודל על כל הקטלוג בכל cold start של השרת.
PRECOMPUTED_EMBEDDINGS_PATH = Path(__file__).resolve().parent.parent / "data" / "frame_embeddings.json"

def _load_precomputed_embeddings() -> dict[str, np.ndarray]:
    if not PRECOMPUTED_EMBEDDINGS_PATH.exists():
        return {}
    with open(PRECOMPUTED_EMBEDDINGS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return {frame_id: np.array(vec) for frame_id, vec in data.get("frames", {}).items()}

# אינדקס הווקטורים — נבנה פעם אחת בהפעלת השרת
_frame_embeddings: list[dict] | None = None

def build_index() -> list[dict]:
    """בונה את אינדקס הווקטורים לכל המסגרות, מהקובץ המוכן מראש כשאפשר,
    ומריץ את המודל רק על מסגרות שלא נמצאו בו (למשל מסגרת שנוספה לאחרונה)."""
    global _frame_embeddings
    if _frame_embeddings is not None:
        return _frame_embeddings

    inventory = load_inventory()
    precomputed = _load_precomputed_embeddings()

    missing = [frame for frame in inventory if frame["id"] not in precomputed]
    if missing:
        texts = [frame_to_text(frame) for frame in missing]
        for frame, embedding in zip(missing, get_embeddings_batch(texts)):
            precomputed[frame["id"]] = embedding

    _frame_embeddings = [
        {"frame": frame, "embedding": precomputed[frame["id"]]}
        for frame in inventory
    ]

    print(f"✅ Embedding index built: {len(_frame_embeddings)} frames ({len(missing)} computed live)")
    return _frame_embeddings

def find_similar_frames(session: dict, top_k: int = 6) -> list[dict]:
    """מוצא את המסגרות הכי דומות לפרופיל הלקוח"""
    index = build_index()

    # ממיר את פרופיל הלקוח לווקטור באמצעות הפונקציה המקומית
    session_text = session_to_text(session)
    session_embedding = get_embedding(session_text)

    rejected_ids = session.get('rejectedFrameIds', [])
    displayed_ids = session.get('displayedFrameIds', [])
    excluded_ids = set([*rejected_ids, *displayed_ids])

    # מחשב דמיון לכל מסגרת
    scored = []
    for item in index:
        frame = item['frame']

        if frame.get('stock') == 0:
            continue
        if frame['id'] in excluded_ids:
            continue

        similarity = cosine_similarity(session_embedding, item['embedding'])
        scored.append({
            "frame": frame,
            "similarity": similarity
        })

    # ממיין לפי דמיון ומחזיר top_k
    scored.sort(key=lambda x: x['similarity'], reverse=True)
    return [item['frame'] for item in scored[:top_k]]