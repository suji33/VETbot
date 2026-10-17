/**
 * PetRiskAssessment — Responsible clinical risk assessment & triage feature.
 * 
 * Safety Guarantee:
 * - Deterministic emergency rules ALWAYS take precedence and cannot be overridden by ML scoring.
 * - This feature does NOT diagnose specific future diseases and does NOT output fake probabilities.
 * - Outputs triage-oriented recommendations based on physiological and temporal risk factors:
 *   1. "Emergency assessment needed"
 *   2. "Prompt veterinary assessment recommended"
 *   3. "More information needed"
 */

import { runSafetyCheck } from './PawGuard';

export interface PetHealthRiskInput {
  species?: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other' | string;
  ageMonths?: number;
  symptoms: string[];
  durationHours?: number;
  appetiteChange?: 'normal' | 'reduced' | 'none_for_24h_plus';
  waterIntakeChange?: 'normal' | 'increased' | 'decreased' | 'none';
  activityChange?: 'normal' | 'mildly_lethargic' | 'unresponsive_or_collapsed';
  history?: string;
}

export type RiskCategory =
  | 'Emergency assessment needed'
  | 'Prompt veterinary assessment recommended'
  | 'More information needed';

export interface PetHealthRiskResult {
  category: RiskCategory;
  primaryReasons: string[];
  recommendedAction: string;
  deterministicEmergencyTriggered: boolean;
  dataLimitationsNotice: string;
}

/**
 * Evaluates the risk profile for a pet's health concern.
 */
export function assessPetHealthRisk(input: PetHealthRiskInput): PetHealthRiskResult {
  const reasons: string[] = [];

  // ── 1. Deterministic Emergency Evaluation (Highest Priority) ───────────────
  // Combine all symptom and history strings to check against PawGuard deterministic rules
  const allText = [
    ...(input.symptoms || []),
    input.history || '',
    input.activityChange === 'unresponsive_or_collapsed' ? 'collapsed unresponsive' : '',
  ].join(' ');

  const emergencyCheck = runSafetyCheck(allText);

  if (emergencyCheck.isEmergency || input.activityChange === 'unresponsive_or_collapsed') {
    if (emergencyCheck.flaggedPatterns.length > 0) {
      reasons.push(`Emergency clinical signs identified: ${emergencyCheck.flaggedPatterns.join(', ')}`);
    } else {
      reasons.push('Pet is reported as unresponsive or collapsed.');
    }

    return {
      category: 'Emergency assessment needed',
      primaryReasons: reasons,
      recommendedAction: 'Transport your pet to the nearest emergency veterinary hospital immediately. Do not wait or attempt home remedies.',
      deterministicEmergencyTriggered: true,
      dataLimitationsNotice: 'This is a deterministic emergency triage rule. It does not constitute a disease diagnosis.',
    };
  }

  // ── 2. Insufficient Information Check ──────────────────────────────────────
  const hasSymptoms = input.symptoms && input.symptoms.length > 0;
  const hasAppetiteChange = input.appetiteChange && input.appetiteChange !== 'normal';
  const hasActivityChange = input.activityChange && input.activityChange !== 'normal';

  if (!hasSymptoms && !hasAppetiteChange && !hasActivityChange) {
    return {
      category: 'More information needed',
      primaryReasons: ['No active symptoms or significant behavioral/appetite changes were reported.'],
      recommendedAction: 'Please provide specific symptoms, their duration, or changes in your pet’s behavior for an initial assessment.',
      deterministicEmergencyTriggered: false,
      dataLimitationsNotice: 'Baseline risk profiling requires known symptoms, duration, and behavioral indicators.',
    };
  }

  // ── 3. High Clinical Risk / Prompt Veterinary Assessment Factors ───────────
  let promptExamNeeded = false;

  // Appetite loss duration
  if (input.appetiteChange === 'none_for_24h_plus') {
    promptExamNeeded = true;
    reasons.push('Total lack of food intake for 24 hours or longer');
  }

  // Water intake cessation
  if (input.waterIntakeChange === 'none') {
    promptExamNeeded = true;
    reasons.push('Lack of water intake puts pets at rapid risk of dehydration');
  }

  // Temporal duration exceeding 48 hours
  if (input.durationHours && input.durationHours >= 48) {
    promptExamNeeded = true;
    reasons.push(`Symptoms have persisted for ${input.durationHours} hours`);
  }

  // Vulnerable life stage (puppy/kitten < 3 months or geriatric)
  if (input.ageMonths !== undefined && input.ageMonths < 3) {
    promptExamNeeded = true;
    reasons.push('Very young animals (under 12 weeks) have minimal physiologic reserve');
  }

  // Specific concerning non-emergency symptoms
  const concerningKeywords = /vomit|diarrhea|blood|rash|allergy|limp|swelling|wound|discharge|scratching/i;
  for (const s of input.symptoms) {
    if (concerningKeywords.test(s)) {
      promptExamNeeded = true;
      reasons.push(`Reported symptom requires clinical evaluation: "${s}"`);
    }
  }

  if (promptExamNeeded) {
    return {
      category: 'Prompt veterinary assessment recommended',
      primaryReasons: reasons,
      recommendedAction: 'Schedule an in-person veterinary appointment today or within 24 hours. Ensure fresh water is available and observe for any worsening.',
      deterministicEmergencyTriggered: false,
      dataLimitationsNotice: 'Structured triage assessment based on clinical duration and systemic indicators. Machine learning predictive models require validated external clinical data before enabling automated disease likelihood estimation.',
    };
  }

  // Default to more information
  return {
    category: 'More information needed',
    primaryReasons: ['Reported signs appear mild, but more clinical context is needed to assess progression.'],
    recommendedAction: 'Monitor your pet closely over the next 12-24 hours. If appetite, drinking, or energy declines, consult a veterinarian.',
    deterministicEmergencyTriggered: false,
    dataLimitationsNotice: 'Deterministic emergency rules did not trigger. Predictive modeling requires formal validated clinical datasets.',
  };
}
