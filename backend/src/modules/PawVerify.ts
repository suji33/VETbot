import { reviewAnswer } from '../adapters/ModelAdapter';
import { RetrievedPassage } from './VetKnowledgeRAG';

/**
 * PawVerify — Conditional response reviewer module.
 * 
 * Called ONLY when PawGuard flags a response as high-risk.
 * Uses LLM #3 to check for unsupported claims and missing safety guidance.
 * A reviewer failure NEVER suppresses emergency information.
 */

export interface VerifyResult {
  approved: boolean;
  finalAnswer: string;
  reviewIssues: string[];
  wasReviewed: boolean;
}

export async function verifyResponse(
  draftAnswer: string,
  ragPassages: RetrievedPassage[],
  userQuestion: string,
  timeoutMs = 8000,
): Promise<VerifyResult> {
  const passageText = ragPassages.length > 0
    ? ragPassages.map((p) => `[${p.sourceTitle}]: ${p.text}`).join('\n\n')
    : 'No reference passages were retrieved.';

  let result: { approved: boolean; issues: string[]; revisedAnswer?: string };

  try {
    const reviewPromise = reviewAnswer(draftAnswer, passageText, userQuestion);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PawVerify timeout')), timeoutMs),
    );

    result = await Promise.race([reviewPromise, timeoutPromise]);
  } catch (err) {
    console.warn('PawVerify failed or timed out — using draft answer:', (err as Error).message);
    // Reviewer failure: use draft but flag it
    return {
      approved: false,
      finalAnswer: draftAnswer,
      reviewIssues: ['Reviewer unavailable — draft answer used without full review'],
      wasReviewed: false,
    };
  }

  return {
    approved: result.approved,
    finalAnswer: result.approved
      ? draftAnswer
      : (result.revisedAnswer || draftAnswer),
    reviewIssues: result.issues || [],
    wasReviewed: true,
  };
}
