import mongoose from 'mongoose';
import { runSafetyCheck, scanResponse } from '../modules/PawGuard';
import { extractContext, ExtractedContext } from '../modules/PetMindNLP';
import { analyzeVetImage, validateImage, VisionObservation } from '../modules/PawVision';
import { retrievePassages, RetrievedPassage } from '../modules/VetKnowledgeRAG';
import { generateAnswer, VetSageResponse, synthesizeGroundedClinicalAnswer } from '../modules/VetSage';
import { verifyResponse } from '../modules/PawVerify';
import { Conversation } from '../db/models/Conversation';
import { Pet } from '../db/models/Pet';
import { lastModelUsed } from '../adapters/ModelAdapter';
import {
  updateConversationContext,
  formatContextForPrompt,
  IConversationContext,
} from '../modules/ConversationContext';

/**
 * PawOrchestrator — Central routing and coordination module.
 */

export interface ChatRequest {
  sessionId: string;
  conversationId?: string;
  message: string;
  imageBuffer?: Buffer;
  imageMimeType?: string;
  imageOriginalName?: string;
  petId?: string;
  timezone?: string;
}

export interface ChatResponse {
  conversationId: string;
  answer: string;
  sources: Array<{ title: string; url?: string; excerpt: string }>;
  isEmergency: boolean;
  intent: string;
  processingSteps: string[];
}

export async function orchestrate(req: ChatRequest): Promise<ChatResponse> {
  const steps: string[] = [];

  // ── Step 1: Pre-check safety (ALWAYS runs first) ────────────
  steps.push('PawGuard pre-check');
  const preSafety = runSafetyCheck(req.message);

  if (preSafety.isEmergency) {
    steps.push('⚠️ Emergency detected — returning immediate safety guidance');
    const convId = await saveMessage(req.sessionId, req.conversationId, req.message, preSafety.emergencyMessage!, true, []);
    return {
      conversationId: convId,
      answer: preSafety.emergencyMessage!,
      sources: [],
      isEmergency: true,
      intent: 'emergency',
      processingSteps: steps,
    };
  }

  // Check for injection attacks
  if (preSafety.flaggedPatterns.includes('prompt injection attempt detected')) {
    const convId = await saveMessage(req.sessionId, req.conversationId, req.message,
      'I can only help with pet care questions. Is there something about your pet I can assist with?', false, []);
    return {
      conversationId: convId,
      answer: 'I can only help with pet care questions. Is there something about your pet I can assist with?',
      sources: [],
      isEmergency: false,
      intent: 'safety_block',
      processingSteps: steps,
    };
  }

  // ── Step 2: Load conversation history & structured context ──
  steps.push('Loading conversation history');
  const { history, conversation } = await loadHistory(req.sessionId, req.conversationId);
  const conversationCtx: IConversationContext = updateConversationContext(
    req.message,
    history,
    conversation?.context,
  );

  // Load registered pet from MongoDB Atlas to personalize advice (if connected)
  if (mongoose.connection.readyState === 1) {
    try {
      const registeredPets = await Pet.find({
        $or: [{ ownerId: req.sessionId }, { ownerId: 'default_pet_owner' }],
      }).sort({ createdAt: -1 });
      const activePet = (req.petId ? await Pet.findById(req.petId) : null) || registeredPets[0] || (await Pet.findOne().sort({ createdAt: -1 }));
      if (activePet) {
        if (!conversationCtx.species) conversationCtx.species = activePet.species;
        if (!conversationCtx.breed && activePet.breed) conversationCtx.breed = activePet.breed;
        if (!conversationCtx.age && activePet.age) conversationCtx.age = `${Math.floor(activePet.age / 12)}y ${activePet.age % 12}m`;
        steps.push(`Personalized with registered pet: ${activePet.name} (${activePet.species})`);
      }
    } catch (err) {
      // Non-blocking pet context load
    }
  }

  // ── Step 3: Image validation (if present) ───────────────────
  let visionObservation: VisionObservation | undefined;

  if (req.imageBuffer && req.imageMimeType && req.imageOriginalName) {
    steps.push('Validating image');
    const validation = validateImage(req.imageBuffer, req.imageMimeType, req.imageOriginalName);

    if (!validation.valid) {
      const convId = await saveMessage(req.sessionId, req.conversationId,
        req.message, `⚠️ ${validation.error}`, false, [], conversationCtx);
      return {
        conversationId: convId,
        answer: validation.error!,
        sources: [],
        isEmergency: false,
        intent: 'image_validation_error',
        processingSteps: steps,
      };
    }
    steps.push('Image validated ✓');
  }

  // ── Step 4: PetMind NLP — intent extraction ─────────────────
  steps.push('PetMind NLP — extracting intent');
  const hasImage = !!(req.imageBuffer && req.imageMimeType);
  let context: ExtractedContext;

  try {
    context = await extractContext(req.message, history, hasImage);
    steps.push(`Intent: ${context.intent} (confidence: ${context.confidence})`);
  } catch (err) {
    context = {
      intent: 'general_care',
      requiresVision: hasImage,
      requiresRag: true,
      requiresReminderWorkflow: false,
      confidence: 0.3,
    };
    steps.push('PetMind NLP fallback — general_care');
  }

  // Sync extracted NLP context with accumulated conversation context
  if (conversationCtx.species && !context.petSpecies) {
    const sp = conversationCtx.species.toLowerCase();
    context.petSpecies = (sp === 'dog' || sp === 'cat') ? sp : 'other';
  }
  if (conversationCtx.symptoms.length > 0) {
    context.symptoms = Array.from(new Set([...(context.symptoms || []), ...conversationCtx.symptoms]));
  }

  // ── Step 5: PawVision (if image present) ────────────────────
  let visionNotice = '';
  if (hasImage && req.imageBuffer && req.imageMimeType) {
    steps.push('PawVision — analyzing image');
    try {
      visionObservation = await analyzeVetImage(req.imageBuffer, req.imageMimeType, req.message);
      steps.push('PawVision complete ✓');

      // Record visual observations into context
      if (visionObservation.observableFeatures.length > 0) {
        for (const feat of visionObservation.observableFeatures) {
          if (!conversationCtx.unconfirmedObservations.includes(feat)) {
            conversationCtx.unconfirmedObservations.push(feat);
          }
        }
      }
    } catch (err: any) {
      steps.push('PawVision unavailable — proceeding with clinical guidance');
      visionNotice = '*(Note: Automated image processing is temporarily at daily free capacity, so I cannot visually confirm the photo directly right now. However, I can still provide guidance on what you described.)*\n\n';
    }
  }

  // ── Step 6: VetKnowledge RAG ─────────────────────────────────
  let ragPassages: RetrievedPassage[] = [];

  if (context.requiresRag) {
    steps.push('VetKnowledge RAG — retrieving passages');
    // Include pet species, cumulative symptoms, observable features from photo, and user message
    const ragQuery = [
      conversationCtx.species || context.petSpecies,
      ...(conversationCtx.symptoms || []),
      ...(visionObservation?.observableFeatures || []),
      req.message,
    ].filter(Boolean).join(' ');

    const category = context.intent === 'nutrition_question' ? 'nutrition' : undefined;
    ragPassages = await retrievePassages(ragQuery, category);
    steps.push(`RAG: retrieved ${ragPassages.length} passages`);
  }

  // ── Step 7: VetSage — generate answer ───────────────────────
  steps.push('VetSage — generating answer');
  let vetResponse: VetSageResponse;

  if (hasImage) {
    // Gentle spacing to prevent bursting OpenRouter free-tier concurrent rate limits
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const formattedPetContext = formatContextForPrompt(conversationCtx);

  try {
    vetResponse = await generateAnswer(
      req.message,
      context,
      ragPassages,
      history,
      visionObservation,
      formattedPetContext,
    );
    steps.push(`VetSage complete ✓ (model: ${lastModelUsed || 'google/gemini-3.8-flash'})`);
  } catch (err: any) {
    console.warn('[PawOrchestrator] VetSage generation encountered error, utilizing grounded clinical fallback:', err?.message);
    const fallbackAnswer = synthesizeGroundedClinicalAnswer(
      req.message,
      context,
      ragPassages,
      visionObservation,
      formattedPetContext,
    );
    steps.push('VetSage: grounded clinical synthesis fallback activated');
    vetResponse = {
      answer: fallbackAnswer,
      sources: ragPassages.slice(0, 3).map((p) => ({
        title: p.sourceTitle,
        url: p.sourceUrl,
        excerpt: p.text.slice(0, 350) + '...',
      })),
      hasEmergencyFlag: false,
      uncertaintyLevel: 'medium',
    };
  }

  // ── Step 8: PawVerify (conditional — only for high-risk) ─────
  let finalAnswer = vetResponse.answer;
  let finalSources = vetResponse.sources;

  if (preSafety.requiresReview) {
    steps.push('PawVerify — reviewing high-risk response');
    try {
      const verifyResult = await verifyResponse(vetResponse.answer, ragPassages, req.message);
      finalAnswer = verifyResult.finalAnswer;
      steps.push(verifyResult.approved ? 'PawVerify: approved ✓' : 'PawVerify: revised answer used');
    } catch (err) {
      steps.push('PawVerify failed — using VetSage draft');
    }
  }

  // ── Step 9: Post-response safety scan ───────────────────────
  steps.push('PawGuard post-check');
  const postScan = scanResponse(finalAnswer);
  if (!postScan.safe) {
    steps.push(`Post-scan flags: ${postScan.issues.join(', ')}`);
    finalAnswer += '\n\n_Always consult a qualified veterinarian for health concerns about your pet._';
  }

  // ── Step 10: Save conversation ───────────────────────────────
  if (visionNotice) {
    finalAnswer = visionNotice + finalAnswer;
  }
  steps.push('Saving conversation to MongoDB');
  const convId = await saveMessage(
    req.sessionId,
    req.conversationId || conversation?._id?.toString(),
    req.message,
    finalAnswer,
    false,
    finalSources,
    conversationCtx,
  );

  return {
    conversationId: convId,
    answer: finalAnswer,
    sources: finalSources,
    isEmergency: false,
    intent: context.intent,
    processingSteps: steps,
  };
}

// ── Helpers ───────────────────────────────────────────────────

async function loadHistory(sessionId: string, conversationId?: string) {
  if (mongoose.connection.readyState !== 1) {
    return { history: [], conversation: null };
  }
  try {
    let conversation = conversationId
      ? await Conversation.findOne({ _id: conversationId, sessionId })
      : await Conversation.findOne({ sessionId }).sort({ updatedAt: -1 });

    if (!conversation) {
      conversation = new Conversation({ sessionId, messages: [] });
      await conversation.save();
    }

    const recent = conversation.messages.slice(-6);
    const history = recent.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    return { history, conversation };
  } catch (err) {
    console.error('PawMemory load failed:', err);
    return { history: [], conversation: null };
  }
}

async function saveMessage(
  sessionId: string,
  conversationId: string | undefined,
  userMessage: string,
  assistantMessage: string,
  isEmergency: boolean,
  sources: Array<{ title: string; url?: string; excerpt: string }>,
  context?: IConversationContext,
): Promise<string> {
  if (mongoose.connection.readyState !== 1) {
    return conversationId || 'temp_session';
  }
  try {
    let conv = conversationId
      ? await Conversation.findOne({ _id: conversationId, sessionId })
      : null;

    if (!conv) {
      conv = new Conversation({
        sessionId,
        messages: [],
        title: userMessage.slice(0, 60),
        context: context || {},
      });
    }

    if (context) {
      conv.context = context;
      if (context.species) {
        conv.petSpecies = context.species;
      }
    }

    conv.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    conv.messages.push({
      role: 'assistant',
      content: assistantMessage,
      sources,
      isEmergency,
      timestamp: new Date(),
    });

    await conv.save();
    return conv._id.toString();
  } catch (err) {
    console.error('PawMemory save failed:', err);
    return conversationId || 'unknown';
  }
}

