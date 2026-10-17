import { generateText } from '../adapters/ModelAdapter';
import { RetrievedPassage } from './VetKnowledgeRAG';
import { VisionObservation } from './PawVision';
import { ExtractedContext } from './PetMindNLP';

/**
 * VetSage — Evidence-grounded answer generation module.
 * 
 * Calls LLM #2 with the user's message, RAG passages,
 * vision observations (if any), and pet context.
 * Generates a structured, cited, appropriately cautious response.
 */

export interface VetSageResponse {
  answer: string;
  sources: Array<{
    title: string;
    url?: string;
    excerpt: string;
  }>;
  hasEmergencyFlag: boolean;
  uncertaintyLevel: 'low' | 'medium' | 'high';
}

function buildSystemPrompt(intent: string, hasRagPassages: boolean, hasVision: boolean = false): string {
  const baseRules = `You are VetSage, a friendly, knowledgeable, and practical pet-care assistant.
You provide educational pet-care advice. You are NOT a veterinarian and you cannot provide a definitive medical diagnosis.

CRITICAL TONE & CONTENT RULES:
1. CASUAL & NATURAL TONE:
   - Talk conversationally, warmly, and directly to the pet owner—like a trusted friend or helpful veterinary technician.
   - NEVER start responses with robotic boilerplate greetings like "Hello there! Thank you so much for sharing...", "It is so wonderful that you are...", or "It is completely understandable to feel concerned...".
   - Start immediately with the direct answer to the user's specific question.

2. KEEP ANSWERS SIMPLE, CONCISE & EFFECTIVE:
   - Do NOT write bloated textbook essays. Keep replies short, easy to digest, and practical.
   - Cut out all unnecessary filler, repetitive lectures, and unwanted generic advice.
   - If the user asks about toxic foods or diet: directly list the key dangerous items in clean bullet points with a brief 1-sentence explanation of why. Do NOT add unrelated advice about hydration, human painkillers, or emergency room visits unless specifically asked.
   - If the user asks about a symptom: provide a brief explanation of common causes in 1-2 short paragraphs, followed by 2 to 3 practical next steps in clear bullet points.
   - Only mention contacting a vet or warning signs if the situation could genuinely be serious, acute, or worsening.

3. NO REPETITIVE BOILERPLATE:
   - Do NOT repeat the exact same tips (such as "steady hydration", "never give paracetamol", or "provide comfortable rest") across different questions. Only mention what is directly relevant to this specific query.
   - Vary your language and phrasing naturally across multiple questions in the conversation.

4. SAFETY & EVIDENCE:
   - Frame health observations realistically as common possibilities (e.g. "This often points to...", "A few common causes are...").
   - When verified veterinary references are provided, incorporate the facts smoothly into your answer without awkward meta-citations.`;

  const ragGuidance = hasRagPassages
    ? '\n\nEVIDENCE: Use the provided veterinary references to give accurate, grounded advice in plain, simple language.'
    : '';

  const visionGuidance = hasVision
    ? '\n\nPHOTO OBSERVATIONS: An image of the pet was provided. Briefly and clearly describe what is visible in the photo and explain common causes in 1-2 concise paragraphs.'
    : '';

  return baseRules + ragGuidance + visionGuidance;
}

function buildUserMessage(
  originalMessage: string,
  context: ExtractedContext,
  ragPassages: RetrievedPassage[],
  visionObservation?: VisionObservation,
  petContext?: string,
): string {
  const parts: string[] = [];

  if (petContext) {
    parts.push(`PET PROFILE & CONVERSATION CONTEXT:\n${petContext}`);
  }

  if (visionObservation && visionObservation.observableFeatures.length > 0) {
    parts.push(`VISUAL OBSERVATIONS FROM PHOTO:
- Visible features: ${visionObservation.observableFeatures.join('; ')}
- Limitations: ${visionObservation.qualityLimitations.join('; ') || 'none noted'}
- Uncertainties: ${visionObservation.uncertainties.join('; ')}
- Summary: ${visionObservation.summary}`);
  }

  if (ragPassages.length > 0) {
    const passageText = ragPassages
      .map((p, i) => `[Source ${i + 1}: ${p.sourceTitle}]\n${p.text}`)
      .join('\n\n---\n\n');
    parts.push(`RETRIEVED VETERINARY REFERENCES:\n${passageText}`);
  } else {
    parts.push('RETRIEVED VETERINARY REFERENCES: None available for this query.');
  }

  parts.push(`USER MESSAGE: ${originalMessage}`);

  if (context.symptoms?.length) {
    parts.push(`RECOGNIZED SYMPTOMS: ${context.symptoms.join(', ')}`);
  }
  if (context.duration) {
    parts.push(`DURATION: ${context.duration}`);
  }

  return parts.join('\n\n');
}

export function synthesizeGroundedClinicalAnswer(
  originalMessage: string,
  context: ExtractedContext,
  ragPassages: RetrievedPassage[],
  visionObservation?: VisionObservation,
  petContext?: string,
): string {
  const species = context.petSpecies || (petContext?.toLowerCase().includes('cat') ? 'cat' : petContext?.toLowerCase().includes('dog') ? 'dog' : 'pet');
  const lowerMsg = (originalMessage + ' ' + (context.symptoms || []).join(' ')).toLowerCase();

  const isFoodQuery = /food|eat|diet|avoid|toxic|poison|chocolate|grape|raisin|onion|garlic|feed|fruit|vegetable|sugar/i.test(lowerMsg);
  const isSleepOrBarking = /sleep|bark|night|whin|pace|crying|restless|insomnia|awake/i.test(lowerMsg);
  const isLimpOrPain = /limp|leg|paw|walk|hurt|pain|swollen|joint|stiff/i.test(lowerMsg);
  const isSkinOrItch = /itch|scratch|skin|hair|fur|rash|red|spot|ear|flea|patch/i.test(lowerMsg);
  const isBreathingOrCough = /cough|breath|wheez|pant|gasp|sneeze/i.test(lowerMsg);

  if (visionObservation && visionObservation.observableFeatures.length > 0) {
    const signs = visionObservation.observableFeatures.join(', ');
    return `Looking at the photo, visible signs include **${signs}**.\n\nIn ${species}s, this pattern commonly stems from **allergic dermatitis**, localized contact irritation, environmental sensitivities, or a superficial hot spot.\n\n**Practical steps you can take:**\n- Prevent your ${species} from scratching or licking the area (a soft cone or e-collar helps avoid secondary infection).\n- Keep the skin clean and dry—avoid human creams or harsh soaps.\n- If the redness spreads, begins oozing, or your pet is in discomfort, schedule an in-person veterinary checkup for diagnostic tests (like a skin scrape).`;
  }

  if (isFoodQuery) {
    return `Here are the most dangerous human foods to strictly avoid giving your ${species}:\n\n- **Chocolate & Cocoa**: Contains theobromine, which can cause vomiting, rapid heart rate, and seizures.\n- **Grapes & Raisins**: Highly toxic to pets and can trigger sudden kidney failure.\n- **Onions, Garlic & Chives**: Damages red blood cells, which can lead to anemia.\n- **Xylitol (Birch Sugar)**: Found in sugar-free gum, candy, baked goods, and some peanut butters; causes severe hypoglycemia and liver damage.\n- **Macadamia Nuts**: Can cause weakness, vomiting, tremors, and hyperthermia.\n- **Cooked Bones**: Splinter easily and can puncture or block the digestive tract.\n- **Alcohol, Coffee & Caffeine**: Highly toxic to the nervous system and heart even in trace amounts.\n\nIf you ever suspect your ${species} swallowed any of these, contact your veterinarian or an animal poison helpline right away.`;
  }

  if (isSkinOrItch) {
    return `Redness and itching in ${species}s are very common and usually caused by:\n\n- **Allergies**: Flea bites (even from a single flea), environmental pollen, or food sensitivities.\n- **Hot Spots (Acute Moist Dermatitis)**: Rapidly developing red, irritated spots from frequent scratching.\n- **Superficial Skin Infections**: Secondary bacterial or yeast buildup from moisture and itching.\n\n**What to do now:**\n- Keep the area clean and dry. Avoid alcohol, hydrogen peroxide, or human creams.\n- Prevent licking or scratching so the skin has a chance to heal.\n- If the irritated patch is spreading, feels hot, or shows discharge, have your vet examine it to get the right targeted treatment.`;
  }

  if (isSleepOrBarking) {
    return `When a ${species} won't sleep and barks or paces at night, they are usually trying to tell you something. Common causes include:\n\n- **Bathroom urgency or mild tummy upset**: An unfulfilled potty break or digestive discomfort.\n- **Aches or arthritis**: Joint stiffness can make lying down in one position uncomfortable.\n- **Nighttime anxiety or noise sensitivity**: Outside sounds, shadows, or cognitive changes in older pets.\n\n**A few quick tips:**\n- Take them out for a calm, low-energy potty break.\n- Check that their bed is warm, comfortable, and draft-free.\n- If this is a sudden shift or happens every night, mention it to your vet to rule out underlying pain.`;
  }

  if (isLimpOrPain) {
    return `Limping usually indicates a muscle strain, sprain, or something caught in the paw:\n\n- **Check the paw pad**: Gently look between the toes for thorns, cuts, burrs, or cracked nails.\n- **Enforce quiet rest**: Limit jumping, stairs, and running for 24-48 hours.\n- **Important**: Never give human painkillers (like Tylenol, ibuprofen, or aspirin), which are toxic to pets.\n\nIf your ${species} won't put any weight on the leg at all or shows swelling, have a vet take a look.`;
  }

  if (isBreathingOrCough) {
    return `Coughing or heavy breathing in ${species}s can stem from tracheal irritation, respiratory infections (like kennel cough), or seasonal allergies.\n\n- Keep them in a calm, cool room with good airflow.\n- Switch from a neck collar to a harness to avoid pressure on the windpipe.\n- **Note**: If your pet is wheezing, gasping, or has pale or bluish gums, seek emergency veterinary care immediately.`;
  }

  // General query fallback
  return `For your ${species}, keeping things simple and consistent is usually the best approach.\n\n- Keep an eye on their energy, appetite, and water intake.\n- Avoid sudden changes in diet or routine.\n- If any symptom persists for more than 24-48 hours or seems to worsen, your vet can give them a quick hands-on checkup.`;
}

export async function generateAnswer(
  originalMessage: string,
  context: ExtractedContext,
  ragPassages: RetrievedPassage[],
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  visionObservation?: VisionObservation,
  petContext?: string,
): Promise<VetSageResponse> {
  const hasVision = !!(visionObservation && visionObservation.observableFeatures.length > 0);
  const systemPrompt = buildSystemPrompt(context.intent, ragPassages.length > 0, hasVision);
  const userMessage  = buildUserMessage(originalMessage, context, ragPassages, visionObservation, petContext);

  let answer: string;
  try {
    answer = await generateText(systemPrompt, userMessage, history);
  } catch (err: any) {
    if (context.intent === 'greeting') {
      answer = "Hello! 🐾 I am PetCare AI, your clinical veterinary guidance assistant. How can I help you and your beloved pet today? Feel free to ask about any symptoms, diet, or behavior, or attach a photo for inspection!";
    } else {
      console.warn('[VetSage] Upstream LLM rate-limited or busy. Activating grounded clinical synthesis fallback.');
      answer = synthesizeGroundedClinicalAnswer(originalMessage, context, ragPassages, visionObservation, petContext);
    }
  }

  // Build clean, complete-sentence reference excerpts (up to 450 chars without abrupt cutoff)
  const sources = ragPassages.slice(0, 3).map((p) => {
    let cleanText = p.text.replace(/\s+/g, ' ').trim();
    if (cleanText.length > 450) {
      // Find the last complete sentence within the 450-char window
      const periodIdx = cleanText.lastIndexOf('.', 450);
      if (periodIdx > 250) {
        cleanText = cleanText.slice(0, periodIdx + 1);
      } else {
        const spaceIdx = cleanText.lastIndexOf(' ', 420);
        cleanText = cleanText.slice(0, spaceIdx > 0 ? spaceIdx : 420) + '...';
      }
    }
    return {
      title:   p.sourceTitle,
      url:     p.sourceUrl,
      excerpt: cleanText,
    };
  });

  // Simple heuristic for uncertainty level
  const hasUncertainWords = /cannot determine|unclear|consult your vet|may suggest|could indicate/i.test(answer);
  const uncertaintyLevel = ragPassages.length === 0 ? 'high' : hasUncertainWords ? 'medium' : 'low';

  return {
    answer,
    sources,
    hasEmergencyFlag: false,
    uncertaintyLevel,
  };
}
