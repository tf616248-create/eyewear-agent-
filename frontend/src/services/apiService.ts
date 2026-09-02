const API_BASE_URL = 'http://localhost:8000/api';

export interface RecommendationRequestPayload {
  faceData: {
    faceShape: string;
    faceWidth: number;
    faceHeight: number;
    ratio: number;
    capturedImage?: string | null;
  };
  answers: {
    usage: string;
    budget: string;
    style: string;
    gender?: string;
  };
  previousFrame?: {
    image?: string | null;
    liked: boolean;
    reason: string;
  } | null;
  rejectedFrameIds: string[];
  displayedFrameIds: string[];
}

export const getRecommendations = async (data: RecommendationRequestPayload) => {
  const response = await fetch(`${API_BASE_URL}/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to get recommendations');
  return response.json();
};

export const sendChatMessage = async (data: unknown) => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to send chat message');
  const rawResponse = await response.text();
  console.info('[chat] raw API response:', rawResponse);
  return JSON.parse(rawResponse);
};

export const sendFeedback = async (data: unknown) => {
  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to send feedback');
  return response.json();
};