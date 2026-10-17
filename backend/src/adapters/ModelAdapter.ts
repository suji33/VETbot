import axios from 'axios';

/**
 * ModelAdapter — single interface to OpenRouter for all AI calls.
 * All LLM calls in the system go through this adapter.
 * Swapping providers means changing only this file.
 */

const getBaseUrl = () => process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

export const MODELS = {
  get conversation() { return (process.env.CONVERSATION_MODEL || 'google/gemma-4-26b-a4b-it:free').trim(); },
  get vision() { return (process.env.VISION_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free').trim(); },
  get answer() { return (process.env.ANSWER_MODEL || 'google/gemma-4-26b-a4b-it:free').trim(); },
  get reviewer() { return (process.env.REVIEWER_MODEL || 'google/gemma-4-26b-a4b-it:free').trim(); },
  get embedding() { return (process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small').trim(); },
};

function authHeaders() {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  if (!apiKey || apiKey === 'sk-or-REPLACE_WITH_YOUR_KEY') {
    throw new Error('OPENROUTER_API_KEY is not configured. Add it to your .env file.');
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:5173',
    'X-Title': 'PetCare AI',
  };
}

const ENABLE_PAID_FALLBACK = process.env.ENABLE_PAID_FALLBACK === 'true';
export let lastModelUsed = '';

const FREE_TEXT_FALLBACKS = [
  'nvidia/nemotron-3.5-super-vl:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nvidia/nemotron-3.5-lightning:free',
  'liquid/lfm-2.5-2.6b:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
];

const FREE_VISION_MODELS = [
  'nvidia/nemotron-3.5-super-vl:free',
  'dots-studio/dots-3-note-preview:free',
  'thinkingmachines/inkling-small:free',
];

async function postWithRetry(url: string, data: any, config: any, maxRetries = 2) {
  const isVision = data.messages?.some((m: any) =>
    Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
  );

  const currentModel = data.model || (isVision ? MODELS.vision : MODELS.answer);
  
  // For vision requests, only use vision-capable models
  const candidateModels = isVision
    ? (currentModel && FREE_VISION_MODELS.includes(currentModel)
        ? [currentModel, ...FREE_VISION_MODELS.filter((m) => m !== currentModel)]
        : FREE_VISION_MODELS)
    : (currentModel.includes(':free')
        ? [currentModel, ...FREE_TEXT_FALLBACKS.filter((m) => m !== currentModel)]
        : [currentModel]);

  let lastError: any = null;

  for (const modelToTry of candidateModels) {
    const payload = { ...data, model: modelToTry };
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await axios.post(url, payload, config);
        lastModelUsed = res.data?.model || modelToTry;
        return res;
      } catch (err: any) {
        lastError = err;
        const status = err.response?.status;
        const errMsg = err.response?.data?.error?.message || err.message || '';
        const isUpstreamBusy =
          status === 429 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          errMsg.includes('ResourceExhausted') ||
          errMsg.includes('rate limit') ||
          errMsg.includes('overloaded') ||
          errMsg.includes('provider_unavailable');

        if (isUpstreamBusy) {
          console.warn(`[OpenRouter ${status || 'busy'}] on ${modelToTry} (attempt ${attempt}/${maxRetries}): ${errMsg.slice(0, 90)}`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
            continue;
          }
          if (candidateModels.length > 1) {
            console.warn(`[OpenRouter ${status || 'busy'}] Switching to next candidate model from ${modelToTry}...`);
          }
          break; // Try next candidate model
        }
        // Non-transient error, break to next candidate or throw
        break;
      }
    }
  }

  if (isVision) {
    const visionErr = new Error('VISION_UNAVAILABLE');
    (visionErr as any).original = lastError;
    throw visionErr;
  }

  if (ENABLE_PAID_FALLBACK) {
    try {
      console.warn(`⚠️ Free tier models exhausted. Falling back to openai/gpt-4o-mini...`);
      const fallbackRes = await axios.post(url, { ...data, model: 'openai/gpt-4o-mini' }, config);
      lastModelUsed = fallbackRes.data?.model || 'openai/gpt-4o-mini';
      return fallbackRes;
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('All free AI models are currently busy. Please try again shortly.');
}

async function callGeminiApi(prompt: string, timeoutMs = 35000): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) throw new Error('No Google/Gemini key');

  // gemini-3.8-flash and gemini-3.5-flash are active, fast, and highly reliable
  const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      };
      const res = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: timeoutMs,
      });
      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 0) {
        lastModelUsed = `google/${model}`;
        return text.trim();
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`[Gemini API ${model}] notice:`, err?.response?.data?.error?.message || err.message);
    }
  }

  throw lastErr || new Error('Gemini API call failed');
}

/** Generate a text response from a conversation model */
export async function generateText(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  modelOverride?: string,
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const historyText = history.length > 0
        ? `\n\nCONVERSATION HISTORY:\n${history.slice(-6).map((h) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n`
        : '';
      const fullPrompt = `${systemPrompt}${historyText}\n\nUSER MESSAGE: ${userMessage}\n\nDirect, casual, and helpful answer (no boilerplate greeting, get straight to the point):`;
      const result = await callGeminiApi(fullPrompt, 35000);
      if (result) return result;
    } catch (geminiErr: any) {
      console.warn('[ModelAdapter] Gemini text generation failed, falling back to OpenRouter:', geminiErr?.message);
    }
  }

  const model = modelOverride || MODELS.answer;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),  // last 3 exchanges for context
    { role: 'user', content: userMessage },
  ];

  const response = await postWithRetry(
    `${getBaseUrl()}/chat/completions`,
    { model, messages, temperature: 0.3, max_tokens: 3000 },
    { headers: authHeaders(), timeout: 45000 },
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI model');
  return content.trim();
}

/** Generate structured JSON output from a model */
export async function generateStructuredOutput<T>(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<T> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const historyText = history.length > 0
        ? `\n\nCONVERSATION HISTORY:\n${history.slice(-4).map((h) => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}\n`
        : '';
      const prompt = `${systemPrompt}\n\nIMPORTANT: Respond ONLY with a valid raw JSON object. Do not include markdown code fences or conversational text.${historyText}\n\nUSER MESSAGE: ${userMessage}`;
      const raw = await callGeminiApi(prompt, 20000);
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      return JSON.parse(cleaned) as T;
    } catch (geminiErr: any) {
      console.warn('[ModelAdapter] Gemini structured output failed, falling back to OpenRouter:', geminiErr?.message);
    }
  }

  const model = MODELS.conversation;

  const messages = [
    {
      role: 'system',
      content: systemPrompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation.',
    },
    ...history.slice(-4),
    { role: 'user', content: userMessage },
  ];

  const response = await postWithRetry(
    `${getBaseUrl()}/chat/completions`,
    { model, messages, temperature: 0.1, max_tokens: 1500 },
    { headers: authHeaders(), timeout: 30000 },
  );

  const raw = response.data?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('Empty structured output from AI model');

  // Strip markdown code fences if model wraps output
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Model returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}

/** Analyze an image with a vision-capable model */
export async function analyzeImage(
  systemPrompt: string,
  textMessage: string,
  base64Image: string,
  mimeType: string,
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    const visionModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];
    for (const vModel of visionModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${vModel}:generateContent?key=${geminiKey}`;
        const payload = {
          contents: [
            {
              parts: [
                { text: `${systemPrompt}\n\n${textMessage}` },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        };
        const res = await axios.post(geminiUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 35000,
        });
        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          lastModelUsed = `google/${vModel}`;
          return text.trim();
        }
      } catch (geminiErr: any) {
        console.warn(`[Gemini Vision ${vModel}] attempt notice:`, geminiErr?.response?.data?.error?.message || geminiErr?.message);
      }
    }
  }

  const model = MODELS.vision;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: textMessage },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Image}` },
        },
      ],
    },
  ];

  const response = await postWithRetry(
    `${getBaseUrl()}/chat/completions`,
    { model, messages, temperature: 0.2, max_tokens: 2500 },
    { headers: authHeaders(), timeout: 45000 },
  );

  const choice = response.data?.choices?.[0];
  const message = choice?.message;
  const content = message?.content || message?.reasoning || choice?.text;
  if (!content) {
    console.warn('DEBUG analyzeImage: choices was:', JSON.stringify(response.data?.choices));
    console.warn('DEBUG analyzeImage: response.data was:', JSON.stringify(response.data));
    throw new Error(`Empty vision response from AI model: ${JSON.stringify(response.data?.error || response.data)}`);
  }
  return content.trim();
}

/** Review a draft answer for quality and safety (PawVerify) */
export async function reviewAnswer(
  draftAnswer: string,
  ragPassages: string,
  userQuestion: string,
): Promise<{ approved: boolean; issues: string[]; revisedAnswer?: string }> {
  const model = MODELS.reviewer;

  const prompt = `You are PawVerify, a medical-safety reviewer for a pet-care AI system.

Review the following draft answer for:
1. Unsupported claims not backed by the provided sources
2. Missing uncertainty statements (the AI should never claim to diagnose)
3. Missing safety or veterinary referral guidance for potentially serious symptoms
4. Any dangerous home-treatment recommendations

USER QUESTION: ${userQuestion}

RETRIEVED SOURCES:
${ragPassages}

DRAFT ANSWER:
${draftAnswer}

Respond ONLY with valid JSON:
{
  "approved": true|false,
  "issues": ["issue 1", "issue 2"],
  "revisedAnswer": "improved answer if not approved, else null"
}`;

  const messages = [{ role: 'user', content: prompt }];

  const response = await postWithRetry(
    `${getBaseUrl()}/chat/completions`,
    { model, messages, temperature: 0.1, max_tokens: 1500 },
    { headers: authHeaders(), timeout: 8000 },
    1,
  );

  const raw = response.data?.choices?.[0]?.message?.content?.trim();
  if (!raw) return { approved: true, issues: ['Reviewer returned empty response — using draft'] };

  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { approved: true, issues: ['Reviewer returned unparseable response — using draft'] };
  }
}

/** Generate an embedding vector for RAG */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await axios.post(
    `${getBaseUrl()}/embeddings`,
    { model: MODELS.embedding, input: text },
    { headers: authHeaders(), timeout: 15000 },
  );

  const embedding = response.data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error('Invalid embedding response');
  return embedding;
}

