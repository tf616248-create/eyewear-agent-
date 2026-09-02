# from fastapi import APIRouter

# router = APIRouter()

# @router.get("/frames")
# def get_frames():
#     return {"message": "Frames endpoint"}

import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter()

INVENTORY_PATH = r"C:\Users\user1\FinalProject\eyewear-agent\backend\data\eyewear_inventory.json"

@router.get("/frames")
def get_frames():
    with open(INVENTORY_PATH, encoding='utf-8') as f:
        frames = json.load(f)
    return {"frames": frames}