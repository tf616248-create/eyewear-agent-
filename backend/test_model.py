from transformers import AutoTokenizer, AutoModel

print("טוען את המודל שכבר הורדת ידנית...")

path = "./models/all-MiniLM-L6-v2/all-MiniLM-L6-v2"

try:
    # הוספת use_fast=False פותרת את בעיית ה-instantiate של הטוקנייזר המקומי
    tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True, use_fast=False)
    model = AutoModel.from_pretrained(path, local_files_only=True)
    
    print("\nהצלחה מלאה! המודל והטוקנייזר נטענו ועובדים אופליין בצורה תקינה.")
    
except Exception as e:
    print(f"\nהתרחשה שגיאה בקריאת הקבצים: {e}")