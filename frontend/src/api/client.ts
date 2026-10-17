import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

export function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem('petcare_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem('petcare_session_id', sessionId);
  }
  return sessionId;
}

// Attach session ID to every request
api.interceptors.request.use((config) => {
  const sessionId = getOrCreateSessionId();
  config.headers['x-session-id'] = sessionId;
  return config;
});

export interface ChatApiResponse {
  conversationId: string;
  answer: string;
  sources: Array<{ title: string; url?: string; excerpt: string }>;
  isEmergency: boolean;
  intent: string;
  processingSteps?: string[];
}

export async function sendMessage(
  message: string,
  sessionId: string,
  conversationId?: string,
  timezone?: string,
): Promise<ChatApiResponse> {
  const res = await api.post('/api/chat', {
    message,
    sessionId,
    conversationId,
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return res.data;
}

export async function sendImageMessage(
  message: string,
  imageFile: File,
  sessionId: string,
  conversationId?: string,
): Promise<ChatApiResponse> {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('message', message || 'Please analyze this image.');
  formData.append('sessionId', sessionId);
  if (conversationId) formData.append('conversationId', conversationId);
  formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);

  const res = await api.post('/api/chat/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function getConversations() {
  const res = await api.get('/api/conversations');
  return res.data.conversations;
}

export async function deleteConversation(id: string) {
  await api.delete(`/api/conversations/${id}`);
}

export interface PetData {
  _id?: string;
  name: string;
  species: 'dog' | 'cat' | 'other' | string;
  breed?: string;
  age?: number;
  weightKg?: number;
  sex?: 'male' | 'female' | 'unknown';
  notes?: string;
}

export interface ReminderData {
  _id?: string;
  petId?: string;
  petName?: string;
  type: 'feeding' | 'vaccination' | 'medication' | 'followup' | 'other';
  title: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  isRecurring?: boolean;
  notificationChannel?: string;
  status?: string;
}

export async function getPets(): Promise<PetData[]> {
  const res = await api.get('/api/pets');
  return res.data.pets;
}

export async function createPet(pet: PetData): Promise<PetData> {
  const res = await api.post('/api/pets', pet);
  return res.data;
}

export async function deletePet(id: string): Promise<void> {
  await api.delete(`/api/pets/${id}`);
}

export async function getReminders(): Promise<ReminderData[]> {
  const res = await api.get('/api/reminders');
  return res.data.reminders;
}

export async function createReminder(reminder: ReminderData): Promise<ReminderData> {
  const res = await api.post('/api/reminders', reminder);
  return res.data;
}

export async function deleteReminder(id: string): Promise<void> {
  await api.delete(`/api/reminders/${id}`);
}

export default api;
