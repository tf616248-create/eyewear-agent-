"""
מחשב מראש embeddings לכל המסגרות בקטלוג ושומר אותם לקובץ JSON.

מריצים את זה פעם אחת (מקומית) כל פעם שהמלאי (eyewear_inventory.json) משתנה.
בלי זה, השרת היה צריך להריץ את המודל על כל 200 המסגרות בכל עליית שרת
קרה (cold start) - תהליך שלוקח עשרות שניות ועלול לגרום ל-timeout/502
על שרת חינמי כמו Render. עם הקובץ המוכן מראש, בזמן ריצה נדרשת רק הפקת
embedding בודד למשפט השאלון של המשתמש (שניות ספורות).

הרצה: .venv/Scripts/python.exe scripts/precompute_embeddings.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from workflow.embedding_service import MODEL_PATH, frame_to_text, load_inventory, get_embeddings_batch

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "frame_embeddings.json"


def main():
    inventory = load_inventory()
    texts = [frame_to_text(frame) for frame in inventory]
    embeddings = get_embeddings_batch(texts)

    data = {
        "model": MODEL_PATH,
        "frames": {
            frame["id"]: embedding.tolist()
            for frame, embedding in zip(inventory, embeddings)
        },
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f)

    print(f"✅ נשמרו embeddings מוכנים מראש ל-{len(data['frames'])} מסגרות → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
