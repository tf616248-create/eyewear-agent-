import { useState, type ReactNode } from 'react';
import { type FaceData, type UserSession, type PreviousFrame } from '../types/face.types';
import { type AgentState } from '../types/agent.types';
import { type FrameWithReason } from './appContextTypes';
import { AppContext } from './contextValue';
import { mapRecommendationsById } from '../data/inventory';

const defaultSession: UserSession = {
  faceData: null,
  answers: { usage: '', budget: '', style: '' },
  selectedFrameId: null,
  previousFrame: null,
};

const defaultAgentState: AgentState = {
  messages: [],
  rejectedFrameIds: [],
  roundCount: 0,
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<UserSession>(defaultSession);
  const [agentState, setAgentState] = useState<AgentState>(defaultAgentState);
  const [recommendations, setRecommendationsState] = useState<FrameWithReason[]>([]);
  const [displayedFrameIds, setDisplayedFrameIds] = useState<string[]>([]);
  const [sessionId] = useState<string>(() => crypto.randomUUID()); // יוצר sessionId אחד קבוע לכל סשן

  const setFaceData = (data: FaceData) =>
    setSession(prev => ({ ...prev, faceData: data }));

  const setAnswers = (answers: UserSession['answers']) =>
    setSession(prev => ({ ...prev, answers }));

  const setSelectedFrame = (id: string) =>
    setSession(prev => ({ ...prev, selectedFrameId: id }));

  const setPreviousFrame = (data: PreviousFrame | null) =>
    setSession(prev => ({ ...prev, previousFrame: data }));

  const setRecommendations = (frames: FrameWithReason[]) => {
    setDisplayedFrameIds(prev => [...new Set([...prev, ...frames.map(frame => frame.id)])]);
    setRecommendationsState(mapRecommendationsById(frames));
  };

  const addMessage = (role: 'user' | 'agent', content: string) =>
    setAgentState(prev => ({
      ...prev,
      roundCount: prev.roundCount + 1,
      messages: [
        ...prev.messages,
        { id: crypto.randomUUID(), role, content, timestamp: new Date() }
      ],
    }));

  const rejectFrame = (id: string) =>
    setAgentState(prev => ({
      ...prev,
      rejectedFrameIds: [...prev.rejectedFrameIds, id],
    }));

  const resetSession = () => {
    setSession(defaultSession);
    setAgentState(defaultAgentState);
    setRecommendationsState([]);
    setDisplayedFrameIds([]);
    // Note: sessionId נשאר קבוע גם לאחר resetSession - כך אפשר לשמור היסטוריה
  };

  return (
    <AppContext.Provider value={{
      session, setFaceData, setAnswers, setSelectedFrame, setPreviousFrame,
      agentState, addMessage, rejectFrame,
      recommendations, setRecommendations, displayedFrameIds,
      sessionId,
      resetSession,
    }}>
      {children}
    </AppContext.Provider>
  );
};