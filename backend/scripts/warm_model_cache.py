"""
מוריד ושומר במטמון המקומי (disk cache) את מודל ה-embeddings.

מריצים את זה כחלק מ-build command בפריסה (Render), כדי שבזמן שהשרת
עולה בפועל הטעינה תהיה מהדיסק המקומי בלבד, בלי לפנות ברשת ל-Hugging Face
Hub ולהסתכן ב-timeout אם הרשת איטית/מוגבלת.

הרצה: .venv/Scripts/python.exe scripts/warm_model_cache.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from transformers import AutoTokenizer, AutoModel
from workflow.embedding_service import MODEL_PATH


def main():
    AutoTokenizer.from_pretrained(MODEL_PATH)
    AutoModel.from_pretrained(MODEL_PATH)
    print(f"✅ מודל ה-embeddings ({MODEL_PATH}) שמור במטמון מקומי")


if __name__ == "__main__":
    main()
