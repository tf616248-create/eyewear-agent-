import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# ב-Windows ה-console לרוב לא ב-UTF-8 כברירת מחדל, וההדפסות עם עברית/אימוג'ים
# בקוד (workflow/*) קורסות על UnicodeEncodeError ומפילות את הבקשה עם 500.
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# טעינת משתני סביבה
load_dotenv()

app = FastAPI(title="Eyewear Agent API")

# רשימת המקורות המורשים - כולל את פורט 5174 שבו ה-React שלך משתמש בפועל
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # מאפשר את כל ה-HTTP Methods (POST, GET, OPTIONS וכו')
    allow_headers=["*"],  # מאפשר את כל ה-Headers מהפרונטאנד
)

# ייבוא ה-Routers (הועבר לראש הקובץ כמקובל)
from routers.recommendations import router as recommendations_router
from routers.chat import router as chat_router
from routers.feedback import router as feedback_router
from routers.frames import router as frames_router

# חיבור ה-Routers לאפליקציה
app.include_router(recommendations_router, prefix="/api", tags=["recommendations"])
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(feedback_router, prefix="/api", tags=["feedback"])
app.include_router(frames_router, prefix="/api", tags=["frames"])

@app.get("/")
def read_root():
    return {"message": "Eyewear Agent Backend"}