import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sendMessage, sendImageMessage, type ChatApiResponse } from '../api/client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imagePreview?: string;
  sources?: Array<{ title: string; url?: string; excerpt: string }>;
  isEmergency?: boolean;
  intent?: string;
  processingSteps?: string[];
  timestamp: Date;
}

function getOrCreateSession(): string {
  let id = localStorage.getItem('petcare_session_id');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('petcare_session_id', id);
  }
  return id;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const sessionId = getOrCreateSession();

  const addMessage = useCallback((msg: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages((prev) => [...prev, { ...msg, id: uuidv4(), timestamp: new Date() }]);
  }, []);

  const sendChat = useCallback(
    async (text: string, imageFile?: File) => {
      if (!text.trim() && !imageFile) return;
      setError(null);

      // Add user message immediately
      addMessage({
        role: 'user',
        content: text,
        imagePreview: imageFile ? URL.createObjectURL(imageFile) : undefined,
      });

      setIsLoading(true);
      try {
        let response: ChatApiResponse;

        if (imageFile) {
          response = await sendImageMessage(text, imageFile, sessionId, conversationId);
        } else {
          response = await sendMessage(text, sessionId, conversationId);
        }

        if (response.conversationId) {
          setConversationId(response.conversationId);
        }

        addMessage({
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          isEmergency: response.isEmergency,
          intent: response.intent,
          processingSteps: response.processingSteps,
        });
      } catch (err: any) {
        let msg =
          err?.response?.data?.error ||
          err?.response?.data?.details?.[0];

        if (!msg) {
          if (err?.message?.includes('Network Error') || err?.code === 'ERR_NETWORK') {
            msg = 'Unable to reach the AI backend service. If this is a hosted deployment, the cloud server may be waking up from idle. Please try again in a few seconds.';
          } else if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
            msg = 'The AI model took longer than usual to respond. Please try submitting your message again.';
          } else {
            msg = 'The service encountered a temporary delay. Please try your request again in a moment.';
          }
        }
        setError(msg);
        addMessage({
          role: 'assistant',
          content: msg,
          isEmergency: false,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, conversationId, addMessage],
  );

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
  }, []);

  return { messages, isLoading, error, sessionId, conversationId, sendChat, startNewConversation };
}
