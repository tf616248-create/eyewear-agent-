export type MessageRole = 'user' | 'agent';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface AgentState {
  messages: Message[];
  rejectedFrameIds: string[]; // ← מה שנדחה לא יוצע שוב
  roundCount: number;        //  ← אחרי 4 סיבובים → שאלת הבהרה
}