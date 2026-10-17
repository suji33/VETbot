/**
 * ConversationContext — Multi-turn conversation tracking & reference resolution.
 * 
 * Preserves pet details across turns, resolves pronouns ("it", "this", "that problem"),
 * accumulates symptoms without duplicates, and detects when the user switches to a different pet.
 */

export interface IConversationContext {
  species?: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other' | string;
  petName?: string;
  breed?: string;
  age?: string;
  symptoms: string[];
  duration?: Record<string, string>;
  knownAnswers?: Record<string, string>;
  unconfirmedObservations: string[];
  urgency?: 'normal' | 'requires veterinary assessment' | 'emergency';
  lastDiscussedTopic?: string;
}

const COMMON_SPECIES = ['dog', 'cat', 'rabbit', 'bird', 'hamster', 'guinea pig', 'ferret', 'horse', 'reptile', 'parrot'];

/**
 * Detects if the user is switching to a different pet in the current message.
 * e.g., "Now for my cat", "I also have a bird", "My other dog Max"
 */
export function isPetSwitch(message: string, currentSpecies?: string): { switched: boolean; newSpecies?: string; newName?: string } {
  const lower = message.toLowerCase();
  
  // Look for pet switch triggers
  const switchPatterns = [
    /(?:now\s+(?:about|for)|switch\s+to|what\s+about|i\s+also\s+have)\s+(?:my\s+)?(dog|cat|rabbit|bird|puppy|kitten|hamster|ferret)/i,
    /my\s+(?:other|second)\s+(dog|cat|rabbit|bird|pet)\b/i,
    /(?:regarding|about)\s+my\s+(?:other\s+)?(cat|dog|rabbit|bird|puppy|kitten)/i,
  ];

  for (const pattern of switchPatterns) {
    const match = lower.match(pattern);
    if (match) {
      let detected = match[1].toLowerCase();
      if (detected === 'puppy') detected = 'dog';
      if (detected === 'kitten') detected = 'cat';
      if (!currentSpecies || detected !== currentSpecies.toLowerCase()) {
        return { switched: true, newSpecies: detected };
      }
    }
  }

  return { switched: false };
}

/**
 * Updates or builds structured conversation context based on chat history and current message.
 */
export function updateConversationContext(
  currentMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  existingContext?: Partial<IConversationContext>,
): IConversationContext {
  const lower = currentMessage.toLowerCase();
  
  // Check for pet switch first
  const switchCheck = isPetSwitch(currentMessage, existingContext?.species);
  if (switchCheck.switched) {
    return {
      species: switchCheck.newSpecies || 'other',
      petName: switchCheck.newName,
      symptoms: extractSymptomsFromText(currentMessage),
      duration: extractDurationFromText(currentMessage),
      knownAnswers: {},
      unconfirmedObservations: [],
      urgency: 'requires veterinary assessment',
      lastDiscussedTopic: currentMessage.slice(0, 50),
    };
  }

  // Inherit existing context or start clean
  const context: IConversationContext = {
    species: existingContext?.species,
    petName: existingContext?.petName,
    age: existingContext?.age,
    symptoms: [...(existingContext?.symptoms || [])],
    duration: { ...(existingContext?.duration || {}) },
    knownAnswers: { ...(existingContext?.knownAnswers || {}) },
    unconfirmedObservations: [...(existingContext?.unconfirmedObservations || [])],
    urgency: existingContext?.urgency || 'normal',
    lastDiscussedTopic: existingContext?.lastDiscussedTopic || '',
  };

  // 1. Detect or preserve species
  if (!context.species) {
    for (const sp of COMMON_SPECIES) {
      if (new RegExp(`\\b${sp}s?\\b`, 'i').test(lower)) {
        context.species = sp;
        break;
      }
    }
    if (/\bpuppy|puppies|canine\b/i.test(lower)) context.species = 'dog';
    if (/\bkitten|kittens|feline\b/i.test(lower)) context.species = 'cat';
  }

  // If still unknown, check previous messages
  if (!context.species && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const pastText = history[i].content.toLowerCase();
      if (/\bdog|puppy|canine\b/i.test(pastText)) { context.species = 'dog'; break; }
      if (/\bcat|kitten|feline\b/i.test(pastText)) { context.species = 'cat'; break; }
      if (/\brabbit|bunny\b/i.test(pastText)) { context.species = 'rabbit'; break; }
      if (/\bbird|parrot\b/i.test(pastText)) { context.species = 'bird'; break; }
    }
  }

  // 2. Extract and accumulate new symptoms
  const newSymptoms = extractSymptomsFromText(currentMessage);
  for (const s of newSymptoms) {
    if (!context.symptoms.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
      context.symptoms.push(s);
    }
  }

  // 3. Extract durations (e.g. "two days", "for 3 hours", "since yesterday")
  const newDurations = extractDurationFromText(currentMessage);
  Object.assign(context.duration || {}, newDurations);

  // 4. Resolve follow-up references ("it", "this", "that problem", "the behaviour")
  const hasPronounRef = /\b(it|this|that|he|she|the problem|this behaviour|that symptom|the same)\b/i.test(lower);
  if (hasPronounRef && context.symptoms.length > 0) {
    context.lastDiscussedTopic = context.symptoms[context.symptoms.length - 1];
  } else if (newSymptoms.length > 0) {
    context.lastDiscussedTopic = newSymptoms[newSymptoms.length - 1];
  }

  // 5. Update urgency
  if (context.symptoms.some((s) => /blood|seizure|breathing|collapse|poison|toxic|unresponsive/i.test(s))) {
    context.urgency = 'emergency';
  } else if (context.symptoms.length > 0) {
    context.urgency = 'requires veterinary assessment';
  }

  return context;
}

/**
 * Extracts clinically relevant symptoms mentioned in natural text.
 */
function extractSymptomsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const symptoms: string[] = [];

  const symptomMatchers: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(not eating|loss of appetite|won'?t eat|refusing food|anorexia|not eaten)\b/i, label: 'not eating / appetite loss' },
    { pattern: /\b(vomit\w*|throwing up|retching)\b/i, label: 'vomiting' },
    { pattern: /\b(diarrhea|runny stool|loose stool)\b/i, label: 'diarrhea' },
    { pattern: /\b(scratch\w*|itch\w*|pruritus)\b/i, label: 'itching / scratching' },
    { pattern: /\b(red patch\w*|rash\w*|redness|skin irritation|allergy)\b/i, label: 'skin redness / allergy' },
    { pattern: /\b(hair loss|alopecia|bald spot\w*)\b/i, label: 'hair loss' },
    { pattern: /\b(cough\w*|wheez\w*|sneez\w*)\b/i, label: 'coughing / sneezing' },
    { pattern: /\b(limp\w*|lameness|trouble walking)\b/i, label: 'limping / mobility difficulty' },
    { pattern: /\b(letharg\w*|tired|sluggish|no energy|weakness)\b/i, label: 'lethargy / weakness' },
    { pattern: /\b(shaking head|scratching ear\w*|ear discharge)\b/i, label: 'ear irritation / head shaking' },
    { pattern: /\b(teeth grinding|bruxing)\b/i, label: 'teeth grinding' },
    { pattern: /\b(not drinking|drinking excessively|thirsty)\b/i, label: 'drinking habit change' },
    { pattern: /\b(swollen belly|bloat|distended)\b/i, label: 'abdominal distension / bloat' },
  ];

  for (const item of symptomMatchers) {
    if (item.pattern.test(lower)) {
      symptoms.push(item.label);
    }
  }

  return symptoms;
}

/**
 * Extracts temporal durations from user messages (e.g. "two days", "3 hours", "since morning").
 */
function extractDurationFromText(text: string): Record<string, string> {
  const lower = text.toLowerCase();
  const durations: Record<string, string> = {};

  const match = lower.match(/\b(for\s+)?(\d+|one|two|three|four|five|six|seven|several)\s+(day|days|hour|hours|week|weeks|month|months)\b/i)
    || lower.match(/\b(since\s+(?:yesterday|morning|last\s+night|two\s+days\s+ago))\b/i);

  if (match) {
    durations['symptom_duration'] = match[0].trim();
  }

  return durations;
}

/**
 * Formats context for injection into LLM prompts so it can fluidly resolve references.
 */
export function formatContextForPrompt(ctx: IConversationContext): string {
  const parts: string[] = [];
  if (ctx.species) parts.push(`Species: ${ctx.species}`);
  if (ctx.petName) parts.push(`Name: ${ctx.petName}`);
  if (ctx.age) parts.push(`Age: ${ctx.age}`);
  if (ctx.symptoms.length > 0) parts.push(`Cumulative Reported Symptoms: ${ctx.symptoms.join(', ')}`);
  if (ctx.duration && Object.keys(ctx.duration).length > 0) {
    const dStr = Object.entries(ctx.duration).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(', ');
    parts.push(`Duration: ${dStr}`);
  }
  if (ctx.lastDiscussedTopic) {
    parts.push(`Active Reference ('it'/'this'/'that'): ${ctx.lastDiscussedTopic}`);
  }
  return parts.join('\n');
}
