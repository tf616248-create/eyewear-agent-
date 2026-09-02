# from fastapi import APIRouter

# router = APIRouter()

# @router.post("/feedback")
# def feedback():
#     return {"message": "Feedback endpoint"}
# # 
from fastapi import APIRouter
from pydantic import BaseModel
from workflow.chat_agent import clear_session

router = APIRouter()


class FeedbackRequest(BaseModel):
    sessionId: str
    chosenFrameId: str
    rejectedFrameIds: list[str] = []


@router.post("/feedback")
async def save_feedback(request: FeedbackRequest):
    # מאפס את השיחה
    clear_session(request.sessionId)

    # כאן בעתיד נשמור ל-PostgreSQL
    print(f"📊 Feedback: chosen={request.chosenFrameId}, rejected={request.rejectedFrameIds}")

    return {"success": True}