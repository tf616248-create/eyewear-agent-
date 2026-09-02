# from fastapi import APIRouter

# router = APIRouter()

# @router.post("/chat")
# def chat():
#     return {"message": "Chat endpoint"}
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from workflow.chat_agent import chat

router = APIRouter()


class ChatMessage(BaseModel):
    sessionId: str
    message: str
    session: dict
    rejectedIds: list[str] = []
    displayedFrameIds: list[str] = []


@router.post("/chat")
async def chat_endpoint(request: ChatMessage):
    try:
        result = await chat(
            session_id=request.sessionId,
            user_message=request.message,
            session=request.session,
            rejected_ids=request.rejectedIds,
            displayed_ids=request.displayedFrameIds,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))