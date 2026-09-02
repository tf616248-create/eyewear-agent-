import { createContext } from 'react';
import { type FaceData, type UserSession, type PreviousFrame } from '../types/face.types';
import { type AgentState } from '../types/agent.types';
import { type FrameWithReason } from './appContextTypes';

export interface AppContextType {
  session: UserSession;
  setFaceData: (data: FaceData) => void;
  setAnswers: (answers: UserSession['answers']) => void;
  setSelectedFrame: (id: string) => void;
  setPreviousFrame: (data: PreviousFrame | null) => void;

  agentState: AgentState;
  addMessage: (role: 'user' | 'agent', content: string) => void;
  rejectFrame: (id: string) => void;

  recommendations: FrameWithReason[];
  setRecommendations: (frames: FrameWithReason[]) => void;
  displayedFrameIds: string[];

  sessionId: string;
  resetSession: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);