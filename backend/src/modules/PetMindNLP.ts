import axios from 'axios';
import { generateStructuredOutput } from '../adapters/ModelAdapter';

const isPythonRagEnabled = () => process.env.USE_PYTHON_RAG === 'true';
const getPythonRagUrl = () => process.env.PYTHON_RAG_URL || 'http://localhost:8002';

/**
 * PetMind NLP — Intent detection and structured extraction module.
 * 
 * Calls LLM #1 to understand the user's message and return a
 * structured JSON that tells PawOrchestrator what to do next.
 */

export type Intent =
  | 'symptom_information'   // pet health concern
  | 'nutrition_question'    // feeding / diet
  | 'reminder_create'       // user wants to set a reminder
  | 'reminder_list'         // user wants to see reminders
  | 'reminder_cancel'       // user wants to cancel a reminder
  | 'pet_profile'           // user wants to add/update pet info
  | 'general_care'          // routine care question
  | 'conversation_history'  // user wants to see past chats
  | 'greeting'              // hello / how are you
  | 'unrelated';            // not a pet care question

export interface ExtractedContext {
  intent: Intent;
  petSpecies?: 'dog' | 'cat' | 'other';
  petName?: string;
  symptoms?: string[];
  duration?: string;
  severity?: 'mild' | 'moderate' | 'severe' | 'unknown';
  missingInfo?: string[];
  reminderDetails?: {
    type: string;
    time?: string;
    frequency?: string;
    petName?: string;
  };
  requiresVision: boolean;
  requiresRag: boolean;
  requiresReminderWorkflow: boolean;
  followUpQuestion?: string;  // if info is missing, suggest this question
  confidence: number;         // 0-1, how confident the model is
}

const SYSTEM_PROMPT = `You are PetMind NLP, the intent-detection module of PetCare AI.

Analyze the user's message and return a JSON object with this exact structure:

{
  "intent": "<one of: symptom_information | nutrition_question | reminder_create | reminder_list | reminder_cancel | pet_profile | general_care | conversation_history | greeting | unrelated>",
  "petSpecies": "<dog | cat | other | null>",
  "petName": "<string or null>",
  "symptoms": ["<symptom 1>", "<symptom 2>"],
  "duration": "<duration string or null>",
  "severity": "<mild | moderate | severe | unknown>",
  "missingInfo": ["<what is missing, e.g. age, species>"],
  "reminderDetails": {
    "type": "<feeding | vaccination | medication | followup | other>",
    "time": "<time string or null>",
    "frequency": "<daily | weekly | once | null>",
    "petName": "<string or null>"
  },
  "requiresVision": false,
  "requiresRag": true,
  "requiresReminderWorkflow": false,
  "followUpQuestion": "<suggested follow-up question or null>",
  "confidence": 0.85
}

RULES:
- requiresVision = true only if the user uploaded an image (indicated in message)
- requiresRag = true for symptom, nutrition, and general care questions
- requiresReminderWorkflow = true for reminder_create, reminder_cancel, reminder_list
- symptoms should be individual items, not combined
- Do NOT invent information that is not in the message
- If species is unclear, set petSpecies to null and add "species" to missingInfo
- confidence should reflect how clear the intent is (0.5 = ambiguous, 0.9 = clear)
- reminderDetails is only needed for reminder intents`;

export async function extractContext(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  hasImage = false,
): Promise<ExtractedContext> {
  const trimmed = userMessage.trim().toLowerCase();
  const isGreeting = !hasImage && /^(hi|hii+|hey|heyy+|hello|good\s+(morning|afternoon|evening)|howdy|sup|greetings)(\s+(bro|there|bot|vetbot|doc|doctor|friend|team))?[!.]*$/i.test(trimmed);

  if (isGreeting) {
    return {
      intent: 'greeting',
      requiresVision: false,
      requiresRag: false,
      requiresReminderWorkflow: false,
      confidence: 0.98,
    };
  }

  // Fast-path for image uploads (always dermatology / visual symptom inspection)
  if (hasImage) {
    return {
      intent: 'symptom_information',
      requiresVision: true,
      requiresRag: true,
      requiresReminderWorkflow: false,
      confidence: 0.95,
    };
  }

  // Fast-path for common pet symptom keywords & slang (e.g., "what alergie is this", "not give any sound", "itch")
  const isSymptomPattern = /\b(alerg\w*|allerg\w*|rash|itch\w*|scratch\w*|vomit\w*|diarrh\w*|eat\w*|sound|bleed\w*|blood|cough\w*|sneez\w*|limp\w*|pain|sick|ill|tired|letharg\w*|lump|bump|wound|cut|bite|eye|ear|nose|mouth|stool|urine|pee|poop|fur|hair|swoll\w*)\b/i.test(trimmed);
  if (isSymptomPattern) {
    return {
      intent: 'symptom_information',
      requiresVision: false,
      requiresRag: true,
      requiresReminderWorkflow: false,
      confidence: 0.92,
    };
  }

  // Fast-path for diet and nutrition
  const isNutritionPattern = /\b(food|diet|feed\w*|kibble|eat\w*|nutrition|treat|water|drink\w*)\b/i.test(trimmed);
  if (isNutritionPattern) {
    return {
      intent: 'nutrition_question',
      requiresVision: false,
      requiresRag: true,
      requiresReminderWorkflow: false,
      confidence: 0.90,
    };
  }

  // Fast-path for unrelated queries (coding, politics, general world knowledge)
  const isUnrelatedPattern = /\b(python|code|coding|script|software|program|math|algebra|capital of|weather in|who is the president|stock market)\b/i.test(trimmed);
  if (isUnrelatedPattern) {
    return {
      intent: 'unrelated',
      requiresVision: false,
      requiresRag: false,
      requiresReminderWorkflow: false,
      confidence: 0.95,
    };
  }

  // Fallback to Python NLP if enabled with a tight 4-second timeout
  if (isPythonRagEnabled()) {
    try {
      const res = await axios.post<ExtractedContext>(
        `${getPythonRagUrl()}/nlp/analyze`,
        {
          message: userMessage,
          history,
          hasImage,
        },
        { timeout: 4000 }
      );
      if (res.data && res.data.intent) {
        if (hasImage) res.data.requiresVision = true;
        return res.data;
      }
    } catch (err: any) {
      console.warn(`[Python NLP] Call to ${getPythonRagUrl()} failed (${err.message}). Using TypeScript context.`);
    }
  }

  const message = hasImage
    ? `[User has attached an image] ${userMessage}`
    : userMessage;

  try {
    const result = await generateStructuredOutput<ExtractedContext>(
      SYSTEM_PROMPT,
      message,
      history,
    );

    // Force vision flag if image is present
    if (hasImage) result.requiresVision = true;

    // Validate critical fields
    const validIntents: Intent[] = [
      'symptom_information', 'nutrition_question', 'reminder_create',
      'reminder_list', 'reminder_cancel', 'pet_profile', 'general_care',
      'conversation_history', 'greeting', 'unrelated',
    ];
    if (!validIntents.includes(result.intent)) {
      result.intent = 'general_care';
    }

    return result;
  } catch (err: any) {
    // Graceful fallback: treat as general care question
    const errMsg = err?.response?.data?.error?.message || err?.message || 'Model rate limit';
    console.warn(`⚠️ PetMind NLP notice: ${errMsg}. Using fallback intent analysis.`);
    return {
      intent: 'general_care',
      requiresVision: hasImage,
      requiresRag: true,
      requiresReminderWorkflow: false,
      confidence: 0.3,
    };
  }
}
