/**
 * PawGuard — Deterministic safety module.
 * 
 * Runs BEFORE LLM processing and AFTER answer generation.
 * Does NOT depend on any AI model — uses rule-based pattern matching.
 * Safety rules cannot be overridden by model output.
 */

export interface SafetyCheckResult {
  isEmergency: boolean;
  emergencyMessage?: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'emergency';
  flaggedPatterns: string[];
  requiresReview: boolean;    // triggers PawVerify if true
}

// ── Emergency keyword patterns ────────────────────────────────
// These trigger immediate veterinary guidance with no LLM call.
const EMERGENCY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(can'?t|cannot|not|trouble|difficulty|struggling)\s+(breath|breathe|breathing)\b/i, label: 'breathing difficulty' },
  { pattern: /\b(not breathing|stopped breathing|gasping)\b/i,                                       label: 'not breathing' },
  { pattern: /\b(collaps(ed?|ing)|unconscious|unresponsive|passed out|fainted)\b/i,                  label: 'collapse' },
  { pattern: /\b(seizure|fit|convuls|trembling uncontrollably|shaking violently)\b/i,                 label: 'seizure' },
  { pattern: /\b(poison(ed?|ing)|ate.*(chocolate|xylitol|rat poison|antifreeze|grape|raisin|onion|ibuprofen|paracetamol|tylenol|acetaminophen))\b/i, label: 'suspected poisoning' },
  { pattern: /\b(severe bleeding|bleeding heavily|blood pouring|blood gushing)\b/i,                   label: 'severe bleeding' },
  { pattern: /\b(eye.*(injury|bleeding|bulging|popped)|bulging eye)\b/i,                             label: 'eye injury' },
  { pattern: /\b(can'?t urinate|straining to urinate|no urine|blocked bladder)\b/i,                 label: 'urinary blockage' },
  { pattern: /\b(bloat(ed?|ing)|distend(ed?)|swollen belly.*pain|twisted stomach)\b/i,              label: 'bloat or GDV' },
  { pattern: /\b(broken bone|fracture|hit by car|run over|attacked by)\b/i,                         label: 'trauma' },
  { pattern: /\b(paralys(ed?|is)|can'?t walk|sudden (weakness|paralysis))\b/i,                      label: 'paralysis' },
  { pattern: /\b(heatstroke|heat stroke|overheating|collapsed in heat)\b/i,                         label: 'heatstroke' },
  { pattern: /\b(pale gums|white gums|blue gums|grey gums)\b/i,                                     label: 'pale gums' },
];

// ── High-risk patterns requiring PawVerify review ────────────
const HIGH_RISK_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(vomit(ing)?|throw(ing)? up).*(blood|red)\b/i,       label: 'vomiting blood' },
  { pattern: /\b(blood in (stool|poop|urine|pee|wee))\b/i,           label: 'blood in waste' },
  { pattern: /\b(not eaten|not eating|refuse.*food).*(day|days)\b/i,  label: 'prolonged anorexia' },
  { pattern: /\b(give|administer|dose|dosage|how much).*(medicine|medication|ibuprofen|aspirin|amoxicillin)\b/i, label: 'medication dosage request' },
  { pattern: /\b(diagnose|diagnosis|what disease|what illness|(is it|have|has)\s+(cancer|parvo|distemper|rabies)|cancer|parvo|distemper|rabies)\b/i, label: 'diagnosis request' },
];

// ── Injection attack patterns ─────────────────────────────────
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (previous|above|all) instructions/i,
  /forget (your|the) (rules|guidelines|instructions)/i,
  /you are now|pretend you are|act as if you are/i,
  /reveal (your|the) (system prompt|api key|secret)/i,
  /\bDAN\b|\bjailbreak\b/i,
];

const EMERGENCY_RESPONSE = `🚨 **This sounds like a veterinary emergency.**

**Please contact a veterinarian or emergency animal hospital immediately. Do not wait.**

- Do not attempt home treatment without veterinary guidance.
- Keep your pet calm and warm during transport.
- If possible, call ahead so the clinic can prepare.

📞 **Emergency resources:**
- Your regular vet (call their emergency line)
- Nearest 24-hour emergency animal hospital
- India: Blue Cross Animal Hospital helplines vary by city

_PetCare AI is not able to manage emergencies. Please seek professional help now._`;

export function runSafetyCheck(text: string): SafetyCheckResult {
  const flaggedPatterns: string[] = [];

  // Check for prompt injection attacks
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isEmergency: false,
        riskLevel: 'high',
        flaggedPatterns: ['prompt injection attempt detected'],
        requiresReview: false,
      };
    }
  }

  // Check for emergencies
  for (const { pattern, label } of EMERGENCY_PATTERNS) {
    if (pattern.test(text)) {
      flaggedPatterns.push(label);
    }
  }

  if (flaggedPatterns.length > 0) {
    return {
      isEmergency: true,
      emergencyMessage: EMERGENCY_RESPONSE,
      riskLevel: 'emergency',
      flaggedPatterns,
      requiresReview: false,  // emergency bypasses review
    };
  }

  // Check for high-risk patterns
  const highRiskFlags: string[] = [];
  for (const { pattern, label } of HIGH_RISK_PATTERNS) {
    if (pattern.test(text)) {
      highRiskFlags.push(label);
    }
  }

  if (highRiskFlags.length > 0) {
    return {
      isEmergency: false,
      riskLevel: 'high',
      flaggedPatterns: highRiskFlags,
      requiresReview: true,
    };
  }

  return {
    isEmergency: false,
    riskLevel: 'none',
    flaggedPatterns: [],
    requiresReview: false,
  };
}

/** Post-response safety scan — checks the AI's generated answer */
export function scanResponse(responseText: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];

  // Must not claim to diagnose
  if (/your (pet|dog|cat) (has|definitely has|is suffering from)\b/i.test(responseText)) {
    issues.push('Response may imply diagnosis — should be softened');
  }

  // Must not recommend inducing vomiting without vet guidance
  if (/induce vomiting|make.*(vomit|throw up)/i.test(responseText) &&
      !/veterinarian|vet clinic|professional/i.test(responseText)) {
    issues.push('Response suggests inducing vomiting without vet guidance');
  }

  // Must not recommend specific drug doses independently
  if (/give.*mg|administer.*mg|dose.*mg/i.test(responseText) &&
      !/prescribed by|your vet (said|recommended|instructed)/i.test(responseText)) {
    issues.push('Response may contain unsupported medication dosage');
  }

  return { safe: issues.length === 0, issues };
}
