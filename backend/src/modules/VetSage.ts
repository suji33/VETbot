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
  const lowerMsg = (originalMessage + ' ' + (context.symptoms || []).join(' ')).toLowerCase();
  const rawSpecies = (context.petSpecies && context.petSpecies !== 'other') ? context.petSpecies : '';
  const species =
    rawSpecies ||
    (/\brabbit|bunny\b/i.test(lowerMsg) ? 'rabbit' :
     /\bbird|parrot\b/i.test(lowerMsg) ? 'bird' :
     /\bhamster\b/i.test(lowerMsg) ? 'hamster' :
     /\bguinea pig\b/i.test(lowerMsg) ? 'guinea pig' :
     /\bcat|kitten|feline\b/i.test(lowerMsg) ? 'cat' :
     /\bdog|puppy|canine\b/i.test(lowerMsg) ? 'dog' :
     petContext?.toLowerCase().includes('cat') ? 'cat' :
     petContext?.toLowerCase().includes('dog') ? 'dog' :
     petContext?.toLowerCase().includes('rabbit') ? 'rabbit' :
     petContext?.toLowerCase().includes('bird') ? 'bird' : 'pet');

  // Vision observation path
  if (visionObservation && visionObservation.observableFeatures.length > 0) {
    const signs = visionObservation.observableFeatures.join(', ');
    return `Looking at the photo, visible signs include **${signs}**.\n\nIn ${species}s, this pattern commonly stems from **allergic dermatitis**, localized contact irritation, environmental sensitivities, or a superficial hot spot.\n\n**Practical steps you can take:**\n- Prevent your ${species} from scratching or licking the area (a soft cone or e-collar helps avoid secondary infection).\n- Keep the skin clean and dry—avoid human creams or harsh soaps.\n- If the redness spreads, begins oozing, or your pet is in discomfort, schedule an in-person veterinary checkup for diagnostic tests (like a skin scrape).`;
  }

  // 1. Human medication safety / dosage inquiries (CRITICAL PRIORITY)
  if (/can i give|how much|safe to give|dose|dosage|paracetamol|tylenol|acetaminophen|ibuprofen|advil|motrin|aspirin|aleve|naproxen/i.test(lowerMsg)) {
    return `⚠️ **Strict Warning Regarding Human Medications:**\n\n- **Never administer human painkillers (such as Tylenol/paracetamol, Advil/ibuprofen, or aspirin) to ${species}s.**\n- **Toxicity:** In cats, paracetamol triggers lethal methemoglobinemia and liver failure within hours. In dogs, NSAIDs like ibuprofen cause severe gastric perforations and acute kidney failure even at small doses.\n- **Action:** If your pet is in pain, consult a veterinarian immediately for safe, FDA-approved animal pain relief (such as carprofen or gabapentin) prescribed according to exact body weight.`;
  }

  // 2. Anorexia / Reduced Appetite Queries (Differentiate from general food queries)
  if (/\b(not eating|eating less|won'?t eat|refusing food|loss of appetite|off food|anorexia|eating very little)\b/i.test(lowerMsg)) {
    if (species === 'rabbit') {
      return `⚠️ **Critical Rabbit Warning (Possible GI Stasis):**\n\nWhen a rabbit eats less hay or shows diminished appetite, it is a **major clinical red flag**. Rabbits must continuously digest high-fiber grass hay to keep their digestive tract moving.\n\n- **Check Fecal Output:** Look closely at their litter box. Have fecal pellets decreased in size or stopped entirely?\n- **Veterinary Urgency:** Anorexia in rabbits can trigger irreversible gastrointestinal stasis and hepatic lipidosis within 12 to 24 hours. Contact a rabbit-savvy exotic veterinarian promptly.\n- **Support:** Keep your rabbit warm, calm, and offer fresh aromatic greens (like cilantro or parsley) while arranging veterinary care. Never fast a rabbit.`;
    }
    return `Loss of appetite or reduced eating in **${species}s** indicates systemic illness, nausea, oral pain, or stress.\n\n**Clinical Steps:**\n- **Check Hydration:** Ensure your ${species} is still drinking water. Check their gums—they should be moist and pink, not dry or tacky.\n- **Gentle Encouragement:** Warm their food slightly to enhance aroma, or offer a bland diet (plain boiled chicken and rice for dogs; warm plain poultry broth or wet food for cats).\n- **Timeline:** In adult dogs, an appetite dip of 24 hours warrants monitoring; in cats, going without food for 48 hours risks hepatic lipidosis (fatty liver syndrome). If anorexia continues past 24-48 hours or is accompanied by lethargy, schedule a veterinary visit for bloodwork and an abdominal exam.`;
  }

  // 3. Toxic food & dietary queries
  if (/\b(toxic|poison|poisonous|can (dogs|cats|pets|it) eat|safe to feed|safe for.*to eat|dangerous food|foods to avoid|bad food|chocolate|cocoa|grape(s)?|raisin(s)?|onion(s)?|garlic|leek|chive|xylitol|macadamia|cooked bone)\b/i.test(lowerMsg)) {
    return `Here are critical human foods that are hazardous or strictly toxic to **${species}s**:\n\n- **Chocolate & Cocoa**: Contains theobromine, causing cardiac arrhythmias and seizures.\n- **Grapes & Raisins**: Highly nephrotoxic; can precipitate acute renal failure even in small amounts.\n- **Onions, Garlic, Leeks & Chives**: Induces oxidative damage to red blood cells (Heinz body anemia).\n- **Xylitol (Birch Sugar)**: Causes rapid, severe hypoglycemia followed by acute hepatic necrosis.\n- **Macadamia Nuts**: Induces motor weakness, vomiting, hyperthermia, and tremors.\n- **Cooked Animal Bones**: Splinter easily and risk gastrointestinal perforation or obstruction.\n\nIf ingestion has occurred recently, contact an emergency animal poison helpline or your veterinary clinic immediately.`;
  }

  // 3. Vomiting, diarrhea, and gastroenteritis
  if (/vomit|throw up|diarrhea|loose stool|watery stool|tummy|stomach upset|nausea/i.test(lowerMsg)) {
    return `Vomiting or loose stool in **${species}s** commonly arises from dietary indiscretion, sudden food transitions, viral/bacterial gastroenteritis, or parasites.\n\n**Immediate Clinical Care Measures:**\n- **Hydration:** Provide fresh water. Watch closely for signs of dehydration (dry/tacky gums or skin tenting).\n- **Bland Diet:** Once vomiting subsides for several hours, offer small portions of a bland diet (boiled skinless chicken and white rice for dogs; veterinary gastrointestinal food for cats).\n- **Avoid Human Meds:** Do not administer Pepto-Bismol or human antidiarrheal medicines.\n- **Red Flags:** Seek emergency veterinary evaluation if you observe blood in vomit/stool, persistent retching, extreme lethargy, or if episodes continue for more than 24 hours.`;
  }

  // 4. Ear scratching, head shaking, and otitis
  if (/ear|head shaking|shake head|ear wax|scratch ear|smelly ear|ear discharge/i.test(lowerMsg)) {
    return `Ear scratching, head shaking, or foul odor in **${species}s** is classic for **otitis externa** (outer ear infection), frequently involving yeast, bacteria, or ear mites.\n\n**Practical Management:**\n- **Do Not Use Cotton Swabs (Q-tips):** Inserting swabs into the ear canal can push debris inward or rupture the delicate tympanic membrane (eardrum).\n- **Keep Dry:** Prevent water entry during baths or outdoor play.\n- **Veterinary Cytology:** Schedule an examination where the vet will perform otoscopy and a swab smear to identify whether the infection is yeast, cocci bacteria, or mites, and prescribe targeted antimicrobial/antifungal drops.`;
  }

  // 5. Eye discharge, squinting, and conjunctivitis
  if (/eye|squint|blink|cloudy|discharge|crust|weeping|tear|conjunctiv/i.test(lowerMsg)) {
    return `Eye squinting, redness, or discharge in **${species}s** can indicate conjunctivitis, corneal scratches/ulcers, or foreign material.\n\n**Critical Eye Precautions:**\n- **Never Use Human Eye Drops (or old steroid drops):** Applying steroid drops to a scratched cornea can lead to corneal melting and irreversible blindness.\n- **Prevent Self-Trauma:** Use an Elizabethan collar (cone) to prevent pawing or rubbing against furniture.\n- **Gentle Cleansing:** Flush surrounding skin with sterile isotonic saline only.\n- **Urgency:** Corneal ulcers deteriorate rapidly within 24-48 hours. Have your veterinarian perform a fluorescein stain test to check the surface of the cornea.`;
  }

  // 6. Skin redness, itching, and allergy
  if (/itch|scratch|skin|hair|fur|rash|red|spot|flea|patch|hot spot/i.test(lowerMsg)) {
    return `Redness and itching in **${species}s** commonly result from **allergic dermatitis** (flea allergy, food sensitivities, or environmental atopy) or secondary superficial pyoderma.\n\n**Practical First Steps:**\n- Prevent your ${species} from constant licking or scratching to avoid creating an acute moist dermatitis (hot spot).\n- Keep the skin cool, clean, and dry. Avoid human creams, rubbing alcohol, or hydrogen peroxide.\n- Check between toes and around the tail base for flea dirt or external parasites.\n- Consult your veterinarian for diagnostic skin scrapes or targeted antipruritic therapy (such as cytopoint, apoquel, or medicated dermatological baths).`;
  }

  // 7. If we have verified RAG clinical passages from the veterinary knowledge base, leverage them directly
  if (ragPassages && ragPassages.length > 0) {
    const topPassage = ragPassages[0];
    const cleanSnippet = topPassage.text.replace(/\s+/g, ' ').slice(0, 380).trim();
    
    return `Based on veterinary clinical references for **${species}s**:\n\n${cleanSnippet}...\n\n**Key Clinical Steps:**\n- Monitor your ${species} closely for behavioral shifts, appetite changes, or escalation in symptoms.\n- Ensure free access to fresh, clean drinking water and a quiet, non-stressful rest area.\n- Never administer human over-the-counter painkillers (such as paracetamol, ibuprofen, or aspirin), which can be fatal.\n- If symptoms persist past 24 hours, worsen, or cause acute distress, an in-person physical examination by a licensed veterinarian is essential.`;
  }

  // Skin redness, itching, and allergy
  if (/itch|scratch|skin|hair|fur|rash|red|spot|flea|patch|hot spot/i.test(lowerMsg)) {
    return `Redness and itching in **${species}s** commonly result from **allergic dermatitis** (flea allergy, food sensitivities, or environmental atopy) or secondary superficial pyoderma.\n\n**Practical First Steps:**\n- Prevent your ${species} from constant licking or scratching to avoid creating an acute moist dermatitis (hot spot).\n- Keep the skin cool, clean, and dry. Avoid human creams, rubbing alcohol, or hydrogen peroxide.\n- Check between toes and around the tail base for flea dirt or external parasites.\n- Consult your veterinarian for diagnostic skin scrapes or targeted antipruritic therapy (such as cytopoint, apoquel, or medicated dermatological baths).`;
  }

  // Rabbit & Lagomorph GI health
  if (species === 'rabbit' || /rabbit|bunny|hay|hutch|caecotroph/i.test(lowerMsg)) {
    return `Rabbits have highly specialized hindgut gastrointestinal systems that require continuous motility.\n\n**Critical Rabbit Care:**\n- **Grass Hay:** Timothy or meadow grass hay must make up at least 85% of their daily diet to maintain peristalsis and wear down continuously growing teeth.\n- **GI Stasis Warning:** If a rabbit stops eating hay or stops producing fecal pellets for even 12-24 hours, this represents a life-threatening veterinary emergency (GI stasis).\n- Keep their environment quiet, cool, and predator-free. Ensure fresh water is always available via a bowl or bottle.`;
  }

  // Lameness, limping, and joint stiffness
  if (/limp|leg|paw|walk|hurt|pain|swollen|joint|stiff|arthritis/i.test(lowerMsg)) {
    return `Limping or reluctance to bear weight in **${species}s** points to a soft tissue sprain, joint inflammation, or a paw pad issue.\n\n**Immediate Steps:**\n- **Check the Paw:** Gently inspect between the pads and toes for thorns, burrs, glass, foreign bodies, or torn nails.\n- **Strict Rest:** Limit activity for 24-48 hours. Avoid stairs, running, and jumping on furniture.\n- **No Human NSAIDs:** Never give human pain relievers (aspirin, ibuprofen, paracetamol).\n- **When to See a Vet:** If your ${species} cannot put any weight on the limb, shows localized heat or swelling, or if the limp lasts more than 24 hours, have an X-ray or orthopedic exam conducted.`;
  }

  // Coughing, sneezing, and respiratory symptoms
  if (/cough|breath|wheez|pant|gasp|sneeze|nasal/i.test(lowerMsg)) {
    return `Respiratory symptoms such as coughing or rapid breathing in **${species}s** may indicate infectious tracheobronchitis (kennel cough in dogs / upper respiratory complex in cats), airway irritation, or asthma.\n\n**Care Recommendations:**\n- Keep your pet in a clean, dust-free environment with good air circulation. Avoid aerosol sprays, scented candles, or cigarette smoke.\n- Use a chest harness instead of a neck collar to eliminate pressure on the trachea.\n- **Emergency Warning:** If your ${species} exhibits open-mouth breathing (especially in cats), blue or pale gums, or abdominal effort while breathing, transport them to an emergency veterinary clinic immediately.`;
  }

  // Nighttime barking, pacing, or restlessness
  if (/sleep|bark|night|whin|pace|crying|restless|insomnia|awake/i.test(lowerMsg)) {
    return `Nighttime restlessness or vocalization in **${species}s** typically reflects discomfort, digestive urgency, cognitive shifts, or unmet stimulation.\n\n**Actionable Suggestions:**\n- Offer a calm, low-energy outdoor bathroom break right before bedtime.\n- Ensure their sleeping area is well-cushioned, warm, and away from cold drafts.\n- In senior pets, pacing or disorientation at night can be an early sign of canine/feline cognitive dysfunction syndrome or joint discomfort that worsens when lying still.\n- If the restlessness is new or persistent, mention it during your next veterinary wellness visit to check for subclinical pain.`;
  }

  // Comprehensive clinical response for other health queries
  return `Regarding your inquiry for your **${species}**:\n\n**Clinical Considerations:**\n- Changes in normal daily habits, activity, or comfort are common early indicators of physical or environmental stress.\n- Observe if these signs correlate with recent diet changes, outdoor exposure, or household routine shifts.\n\n**Recommended At-Home Steps:**\n- Track the frequency and duration of what you are observing so you can provide an exact timeline to your vet.\n- Keep your ${species} in a calm, temperature-controlled environment with regular access to fresh water.\n- Avoid any unprescribed medications or sudden dietary alterations.\n- If you notice escalating lethargy, loss of appetite, or distress, a physical checkup with a licensed veterinarian will provide definitive diagnostics and targeted care.`;
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
