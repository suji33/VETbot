import { analyzeImage } from '../adapters/ModelAdapter';

/**
 * PawVision — Image analysis module.
 * 
 * Validates the image, sends it to a vision-capable model,
 * and returns structured observations. Never claims a diagnosis.
 */

export interface VisionObservation {
  observableFeatures: string[];     // what the AI can see
  qualityLimitations: string[];     // image quality issues
  uncertainties: string[];          // what cannot be determined
  veterinaryAssessmentNeeded: boolean;
  additionalInfoNeeded?: string[];  // what user should tell the vet
  summary: string;                  // plain-English summary
}

const VISION_SYSTEM_PROMPT = `You are PawVision, the visual observation module of PetCare AI.

Your role is ONLY to describe what you can see in a pet photograph.

STRICT RULES:
1. Describe ONLY what is visibly present in the image.
2. NEVER state that a pet "has" a specific disease or condition.
3. NEVER rule out internal conditions because the photo looks normal.
4. Always note image quality limitations (blur, lighting, angle).
5. Always recommend veterinary assessment for any concerning finding.
6. If the image does not appear to be a pet photograph, say so clearly.
7. If the image is too blurry or dark to analyze, say so.

Respond with ONLY valid JSON:
{
  "observableFeatures": ["what I can see: e.g., redness on the left ear", "patchy hair loss near tail"],
  "qualityLimitations": ["image is slightly blurry", "area partially obscured"],
  "uncertainties": ["cannot determine depth of wound from photo", "internal conditions cannot be assessed"],
  "veterinaryAssessmentNeeded": true,
  "additionalInfoNeeded": ["when did this start", "is the pet scratching the area"],
  "summary": "one short paragraph describing what is visible and recommending next steps"
}`;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB = Number(process.env.MAX_IMAGE_SIZE_MB) || 10;

export function validateImage(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `File type not supported. Please upload a JPG, PNG, or WebP image. (Received: ${originalName})`,
    };
  }

  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > MAX_SIZE_MB) {
    return {
      valid: false,
      error: `Image is too large (${sizeMB.toFixed(1)} MB). Maximum allowed size is ${MAX_SIZE_MB} MB.`,
    };
  }

  if (buffer.length < 1000) {
    return { valid: false, error: 'Image file appears to be empty or corrupted.' };
  }

  return { valid: true };
}

export class VisionServiceUnavailableError extends Error {
  constructor(message = 'I couldn\'t analyze the image because the vision service is temporarily unavailable. Please try again shortly.') {
    super(message);
    this.name = 'VisionServiceUnavailableError';
  }
}

export async function analyzeVetImage(
  imageBuffer: Buffer,
  mimeType: string,
  userDescription: string,
): Promise<VisionObservation> {
  const base64 = imageBuffer.toString('base64');

  const userMessage = userDescription.trim()
    ? `The pet owner describes: "${userDescription}". Please analyze this image.`
    : 'Please analyze this pet photograph and describe what you observe.';

  try {
    const raw = await analyzeImage(VISION_SYSTEM_PROMPT, userMessage, base64, mimeType);

    // Extract JSON block if surrounded by text or markdown fences
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: VisionObservation;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = {
          observableFeatures: [raw.slice(0, 180)],
          qualityLimitations: [],
          uncertainties: ['Preliminary visual observation'],
          veterinaryAssessmentNeeded: true,
          summary: raw.trim(),
        };
      }
    } else {
      parsed = {
        observableFeatures: [raw.slice(0, 180)],
        qualityLimitations: [],
        uncertainties: ['Preliminary visual observation'],
        veterinaryAssessmentNeeded: true,
        summary: raw.trim(),
      };
    }

    // Safety: ensure vet assessment is always noted for any finding
    if (parsed.observableFeatures && parsed.observableFeatures.length > 0) {
      parsed.veterinaryAssessmentNeeded = true;
    }

    return parsed;
  } catch (err: any) {
    console.error('PawVision analysis failed:', err?.message || err);
    throw new VisionServiceUnavailableError();
  }
}
