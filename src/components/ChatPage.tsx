import { useEffect, useRef, useState } from 'react';
import {
  ref,
  onValue,
  push,
  set,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
} from 'firebase/database';
import { rtdb } from '../firebase';
import { useAuth } from '../AuthContext';
import './ChatPage.css';

interface ChatMessage {
  id: string;
  text: string;
  senderName: string;
  senderEmail: string;
  senderId: string;
  createdAt: number | null;
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'just now';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to messages in real-time via RTDB
  useEffect(() => {
    const messagesRef = ref(rtdb, 'messages');
    const messagesQuery = query(
      messagesRef,
      orderByChild('createdAt'),
      limitToLast(100)
    );

    const unsubscribe = onValue(
      messagesQuery,
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          msgs.push({
            id: childSnapshot.key!,
            text: data.text,
            senderName: data.senderName,
            senderEmail: data.senderEmail || '',
            senderId: data.senderId,
            createdAt: data.createdAt || null,
          });
        });
        setMessages(msgs);
      },
      (err) => {
        console.error('Chat listener error:', err);
        setError('Unable to load messages. Please try again.');
      }
    );

    return () => unsubscribe();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);
    setError(null);

    try {
      const messagesRef = ref(rtdb, 'messages');
      const newRef = push(messagesRef);
      await set(newRef, {
        text: messageText,
        senderName: user.displayName || user.email || 'Anonymous',
        senderEmail: user.email || '',
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
      setNewMessage(messageText);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-page" role="region" aria-label="Chat">
      <div className="chat-header">
        <h2 className="chat-title">Messages</h2>
        <span className="chat-member-count">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {error && (
        <div className="chat-error" role="alert">
          <span>{error}</span>
          <button
            className="chat-error-dismiss"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      <div
        className="chat-messages"
        ref={messagesContainerRef}
        role="log"
        aria-live="polite"
        aria-label="Message list"
      >
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon" aria-hidden="true">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="chat-empty-text">No messages yet</p>
            <p className="chat-empty-hint">Be the first to send a message</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.senderId === user?.uid;
          return (
            <div
              key={msg.id}
              className={`chat-message ${isOwn ? 'chat-message--own' : 'chat-message--other'}`}
            >
              {!isOwn && (
                <div className="chat-message-avatar" aria-hidden="true">
                  {(msg.senderName || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="chat-message-content">
                {!isOwn && (
                  <span className="chat-message-sender">{msg.senderName}</span>
                )}
                <div className="chat-message-bubble">
                  <p className="chat-message-text">{msg.text}</p>
                </div>
                <span className="chat-message-time">
                  {formatRelativeTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <label htmlFor="chat-input" className="visually-hidden">
            Type a message
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            autoComplete="off"
            aria-label="Message input"
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
