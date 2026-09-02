# from fastapi import APIRouter

# router = APIRouter()

# @router.post("/recommendations")
# def get_recommendations():
#     return {"message": "Recommendations endpoint"}
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from workflow.recommendation_chain import get_recommendations

router = APIRouter()


class FaceData(BaseModel):
    faceShape: str
    faceWidth: float
    faceHeight: float
    ratio: float
    capturedImage: str | None = None


class Answers(BaseModel):
    usage: str
    budget: str
    style: str
    gender: str | None = None


class PreviousFrame(BaseModel):
    image: str | None = None
    liked: bool
    reason: str


class RecommendationRequest(BaseModel):
    faceData: FaceData
    answers: Answers
    previousFrame: PreviousFrame | None = None
    rejectedFrameIds: list[str] = []
    displayedFrameIds: list[str] = []


@router.post("/recommendations")
async def recommend(request: RecommendationRequest):
    try:
        session = request.model_dump()
        frames = await get_recommendations(session)
        return {"recommendations": frames}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))