import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/useApp';
import { sendChatMessage } from '../services/apiService';

interface ChatProps {
  onDecide: () => void;
  onBack: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat({ onDecide, onBack }: ChatProps) {
  const { session, setAnswers, setRecommendations, recommendations, agentState, displayedFrameIds, sessionId } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'שלום! אני כאן לעזור לך לבחור את המשקפיים המושלמים. יש לך שאלות על ההמלצות שקיבלת?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const result = await sendChatMessage({
        sessionId: sessionId, // משתמש ב-sessionId קבוע מ-AppContext
        message: input.trim(),
        session: {
          faceData: session.faceData,
          answers: session.answers,
          recommendations: recommendations,
        },
        rejectedIds: agentState.rejectedFrameIds,
        displayedFrameIds,
      });

      if (result.answers) setAnswers(result.answers);
      if (Array.isArray(result.recommendations)) setRecommendations(result.recommendations);
      setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'אירעה שגיאה. נסה שוב.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="chat-screen" dir="rtl">
      {/* Header */}
      <div className="chat-header">
        <button className="chat-back" onClick={onBack}>←</button>
        <div>
          <h2>שאלי את המומחה</h2><p>המלצות, התאמה וכל מה שביניהם</p>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble chat-bubble--${msg.role}`}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble chat-bubble--assistant chat-typing">
            מקליד...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Checkout Button */}
      <div className="chat-checkout">
        <button
          onClick={onDecide}
          className="button button--primary"
        >
          ✅ המשך לרכישה
        </button>
      </div>

      {/* Input */}
      <div className="chat-composer">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="כתוב שאלה..."
          disabled={loading}
          className="chat-input"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="chat-send"
        >
          שלח
        </button>
      </div>
    </main>
  );
}