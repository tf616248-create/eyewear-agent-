import json
import numpy as np
from pathlib import Path
import torch
from transformers import AutoTokenizer, AutoModel

# 1. טעינת המודל והטוקנייזר מהנתיב המקומי — פעם אחת בלבד בהפעלת השרת
# הגדרת נתיב מוחלט ומדויק למיקום המודל על המחשב שלך
MODEL_PATH = r"C:\Users\user1\FinalProject\eyewear-agent\backend\models\all-MiniLM-L6-v2\all-MiniLM-L6-v2"

print("🔄 טוען מודל אמבדינגס מהנתיב המקומי...")
# שימוש בנתיב המוחלט ישירות
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
model = AutoModel.from_pretrained(MODEL_PATH, local_files_only=True)
print("✅ המודל נטען בהצלחה אופליין!")

def get_embedding(text: str) -> np.ndarray:
    """פונקציית עזר להפקת Embedding מתוך הטקסט באמצעות המודל המקומי"""
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
        outputs = model(**inputs)
    
    # ביצוע Mean Pooling (ממוצע הוקטורים) לקבלת וקטור יחיד שמייצג את המשפט
    attention_mask = inputs['attention_mask']
    token_embeddings = outputs.last_hidden_state
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
    sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    embedding = (sum_embeddings / sum_mask).squeeze().numpy()
    
    # נרמול הווקטור (שקול ל-normalize_embeddings=True)
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return embedding

# טעינת המלאי
INVENTORY_PATH = r"C:\Users\user1\FinalProject\eyewear-agent\backend\data\eyewear_inventory.json"

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

# אינדקס הווקטורים — נבנה פעם אחת בהפעלת השרת
_frame_embeddings: list[dict] | None = None

def build_index() -> list[dict]:
    """בונה את אינדקס הווקטורים לכל המסגרות"""
    global _frame_embeddings
    if _frame_embeddings is not None:
        return _frame_embeddings

    inventory = load_inventory()
    
    _frame_embeddings = []
    for frame in inventory:
        text = frame_to_text(frame)
        _frame_embeddings.append({
            "frame": frame,
            "embedding": get_embedding(text) # שימוש בפונקציה המקומית החדשה
        })

    print(f"✅ Embedding index built: {len(_frame_embeddings)} frames")
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