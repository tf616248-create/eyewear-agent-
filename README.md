# Eyewear Agent

Eyewear Agent is a Hebrew eyewear recommendation experience. It scans a face in the browser, retrieves matching frames from a local inventory, ranks them with explicit business rules, and lets the customer refine the result through a persistent chat session.

## Current Stack

- **Frontend:** React 19, TypeScript, Vite
- **Face scan and try-on:** MediaPipe Face Mesh and Three.js; face-api.js is also used by the alternative try-on service
- **Backend:** FastAPI and Python
- **Retrieval embeddings:** local `sentence-transformers/all-MiniLM-L6-v2` model loaded from `backend/models/all-MiniLM-L6-v2`
- **Chat and recommendation explanation:** Gemini API
- **Data:** JSON inventory in `backend/data/eyewear_inventory.json`
- **Persistence:** the current recommendation and chat flow keeps session data in memory on the client/backend process. The `backend/db` files and SQLAlchemy dependencies are not connected to the active flow.

The active code does not use Banuba, ChromaDB, or PostgreSQL. ChromaDB and PostgreSQL-related dependencies are present in `backend/requirements.txt`, but their integration is **planned, not yet implemented**.

## Recommendation Pipeline

1. The frontend captures a camera frame and uses MediaPipe Face Mesh to calculate `faceShape`, dimensions, and face ratio.
2. The backend converts the customer session and every inventory frame into text.
3. The local all-MiniLM-L6-v2 model creates normalized embeddings.
4. Cosine similarity retrieves the top 6 in-stock, non-rejected frames.
5. Rule-based reranking orders those frames using:
   - stock availability
   - budget compatibility
   - style compatibility
   - `face_shapes_match`
   - weight preference
   - optional gender preference
6. Gender is a preference, not a filter. A matching gender or `יוניסקס` adds 10 points; missing gender adds no penalty and never removes a frame.
7. The regular recommendation workflow sends the top-ranked frames to Gemini for explanatory text in Hebrew. Gemini generates explanatory text for the top-ranked frames chosen by embedding+rerank; it does not influence selection or ordering. The chat workflow uses the shared embedding plus reranking path directly when preferences change.

The hybrid approach is measurable: evaluation hit@1 increased from **11.1% to 33.3%** after reranking. Because Gemini only adds explanations after ranking, these evaluation metrics correspond to the frames and order shown to the user.

## Chat and Recommendations

The chat keeps a stable `sessionId` for the conversation. For each user message, the backend extracts only preferences explicitly stated in the text for `style`, `usage`, `budget`, and `gender`. New values are merged into the existing `session.answers`; values are not invented or overwritten when the user did not mention them.

The updated session is passed through the same embedding and rule-based reranking flow. The chat response includes the Hebrew reply, the updated answers, and the refreshed recommendations, so later requests can use the changed preferences.

## Project Layout

```text
backend/
  data/eyewear_inventory.json
  workflow/embedding_service.py
  workflow/reranking_service.py
  workflow/recommendation_chain.py
  workflow/chat_agent.py
  routers/
frontend/
  src/pages/
  src/context/AppContext.tsx
  src/services/
```

## Running Locally

### Backend

Create or activate the backend virtual environment, install the backend dependencies, and set `GEMINI_API_KEY` in the environment. The local embedding model must be available at `backend/models/all-MiniLM-L6-v2/all-MiniLM-L6-v2`.

From the repository root:

```powershell
.\backend\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
uvicorn backend.main:app --reload
```

### Frontend

From `frontend`:

```powershell
npm install
npm run dev
```

The Vite app calls the backend at `http://localhost:8000/api`.

## API Routes Present In Code

The FastAPI application registers these routers under `/api`:

- `POST /api/recommendations`
- `POST /api/chat`
- `POST /api/feedback`
- The frames router is also registered under `/api`

Request and response details should be read from the corresponding router and service modules; this README intentionally does not document contracts that are not defined there.

## Evaluation

Run the recommendation evaluation from the backend environment:

```powershell
python backend\eval_recommendations.py
```

The evaluation includes embedding-only and end-to-end embedding plus reranking cases, including explicit gender preferences.
