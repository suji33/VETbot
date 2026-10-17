"""
LangGraph Nodes for VetBot
Defines modular nodes for:
1. emergency_gate: Instant triage without model delay
2. emergency_response: Direct urgent guidance
3. question_analysis: Species, symptoms & intent extraction
4. document_retrieval: Hybrid ChromaDB + BM25 retrieval
5. answer_generation: Evidence-grounded synthesis
6. safety_validation: Safety auditing & disclaimer enforcement
"""
import re
import logging
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from app.graph.state import VetBotState
from app.rag.retriever import retrieve_passages
from app.rag.schemas import RetrieveRequest
from app.llm.provider import get_chat_model

logger = logging.getLogger("vetbot.graph")

# ── 13+ Deterministic Veterinary Emergency Indicators ──────────────────────────
EMERGENCY_PATTERNS = [
    (r"\b(chocolate|cocoa|theobromine)\b", "Chocolate / Theobromine Toxicosis"),
    (r"\b(bloat|gdv)\b|\b(swollen|distended)\b.*?\b(belly|stomach|abdomen)\b|\bunproductiv\w*\s+retching\b", "Suspected Gastric Dilatation-Volvulus (Bloat/GDV)"),
    (r"\b(rat poison|rodenticide|anticoagulant|bromethalin)\b", "Rodenticide Poisoning"),
    (r"\b(antifreeze|ethylene glycol|sweet coolant)\b", "Ethylene Glycol (Antifreeze) Poisoning"),
    (r"\b(xylitol|birch sugar|sugar free gum)\b", "Xylitol Ingestion"),
    (r"\b(cannot breathe|breathing hard|open mouth breathing|gasping|choking)\b", "Acute Respiratory Distress"),
    (r"\b(seizure|convulsion|tremor|fitting|shaking uncontrollably)\b", "Neurological / Seizure Episode"),
    (r"\b(collapsed|unresponsive|cannot stand|lost consciousness|fainted)\b", "Acute Collapse / Loss of Consciousness"),
    (r"\b(blue gums|pale gums|white gums|cold paws)\b", "Circulatory Compromise / Shock"),
    (r"\b(cannot urinate|straining to pee|blocked cat|crying in litterbox)\b", "Feline Urethral Obstruction / Urinary Blockage"),
    (r"\b(hit by car|hit by vehicle|fallen from height|broken bone|profuse bleeding)\b", "Severe Trauma / Hemorrhage"),
    (r"\b(lily|lilies)\b.*\b(cat|kitten)\b", "Feline Lily Nephrotoxicity"),
    (r"\b(tylenol|acetaminophen|ibuprofen|advil)\b", "Human NSAID / Acetaminophen Toxicity"),
    # Multi-Species Emergency Patterns
    (r"\b(rabbit|bunny|guinea pig|cavy)\b.*?\b(not eating|no poop|no droppings|stopped eating|refusing food|teeth grinding)\b", "Suspected Lagomorph Gastrointestinal Stasis (GI Stasis)"),
    (r"\b(bird|parrot|budgie|cockatiel)\b.*?\b(teflon|non-stick|tail bobbing|egg bound|sitting on bottom|gasping)\b", "Avian Acute Respiratory Distress / Toxic Fumes"),
    (r"\b(ferret)\b.*?\b(collapsed|drooling|seizure|hind leg weakness)\b", "Suspected Ferret Insulinoma / Acute Hypoglycemia"),
    (r"\b(fish|betta|goldfish)\b.*?\b(pineconing|dropsy|swimming upside down|gasping at surface)\b", "Severe Aquatic Organ Failure / Swim Bladder Disorder"),
    (r"\b(bearded dragon|gecko|tortoise|turtle|reptile)\b.*?\b(tremors|shaking|soft shell|rubbery jaw|prolapse|limp)\b", "Acute Reptilian Metabolic Crisis / Prolapse"),
]

def emergency_gate_node(state: VetBotState) -> Dict[str, Any]:
    """
    Step 1: Fast deterministic safety gate.
    Scans the prompt for life-threatening veterinary emergencies without LLM latency.
    """
    msg = state["message"].lower()
    steps = state.get("processing_steps", []) + ["Emergency Gate: Scanning for life-threatening conditions"]

    for pattern, reason in EMERGENCY_PATTERNS:
        if re.search(pattern, msg):
            logger.warning(f"EMERGENCY DETECTED: {reason}")
            steps.append(f"Emergency Gate: DETECTED -> {reason}")
            return {
                "is_emergency": True,
                "emergency_reason": reason,
                "intent": "emergency",
                "processing_steps": steps,
            }

    steps.append("Emergency Gate: Clear (No immediate life-threat pattern)")
    return {
        "is_emergency": False,
        "emergency_reason": None,
        "processing_steps": steps,
    }

def emergency_response_node(state: VetBotState) -> Dict[str, Any]:
    """
    Step 1b: Immediate emergency triage response.
    Bypasses deep model pipelines to recommend prompt veterinary care without delay.
    """
    reason = state.get("emergency_reason") or "Potential Medical Emergency"
    steps = state.get("processing_steps", []) + ["Emergency Response: Formulating immediate triage guidance"]

    answer = (
        f"🚨 **POTENTIAL VETERINARY EMERGENCY: {reason.upper()}**\n\n"
        f"Based on the symptoms described, your pet requires **immediate in-person veterinary medical attention**. "
        f"Do not wait for symptoms to worsen and do not attempt home treatment without explicit instructions from a veterinarian.\n\n"
        f"### Critical Next Steps:\n"
        f"1. **Call Your Nearest Emergency Vet Immediately**: Contact your primary vet clinic or search for the nearest 24/7 Veterinary Emergency Hospital.\n"
        f"2. **Transport Safely**: Keep your pet calm, comfortable, and warm. Avoid putting pressure on the abdomen or chest.\n"
        f"3. **Preserve Packaging/Evidence**: If poisoning is suspected, bring the packaging, plant, or container with you to the clinic.\n"
        f"4. **Emergency Poison Helplines**:\n"
        f"   - **ASPCA Animal Poison Control**: (888) 426-4435\n"
        f"   - **Pet Poison Helpline**: (855) 764-7661\n\n"
        f"*Disclaimer: VetBot cannot diagnose or treat emergency medical conditions. Please seek professional veterinary care immediately.*"
    )

    return {
        "final_answer": answer,
        "draft_answer": answer,
        "sources": [],
        "safety_warnings": [f"Emergency triage triggered for {reason}"],
        "processing_steps": steps + ["Emergency triage guidance dispatched"],
    }

def question_analysis_node(state: VetBotState) -> Dict[str, Any]:
    """
    Step 2: PetMind question analysis.
    Extracts species, symptoms, and intent to optimize downstream RAG retrieval.
    """
    msg = state["message"].lower()
    steps = state.get("processing_steps", []) + ["Question Analysis: Extracting clinical entities and intent"]

    # Detect species across all pet animals
    species = state.get("pet_species")
    if not species or species == "general_pet":
        species_map = [
            (r"\b(cat|kitten|feline|kitty)\b", "cat"),
            (r"\b(dog|puppy|canine|hound|pup)\b", "dog"),
            (r"\b(rabbit|bunny|hare|lagomorph)\b", "rabbit"),
            (r"\b(bird|parrot|parakeet|budgie|cockatiel|macaw|canary|conure|finch|cockatoo|avian)\b", "bird"),
            (r"\b(guinea pig|cavy)\b", "guinea pig"),
            (r"\b(hamster|gerbil|chinchilla|mouse|rat|rodent)\b", "small rodent"),
            (r"\b(ferret)\b", "ferret"),
            (r"\b(turtle|tortoise|terrapin)\b", "turtle"),
            (r"\b(reptile|lizard|bearded dragon|gecko|iguana|chameleon|snake|python)\b", "reptile"),
            (r"\b(fish|betta|goldfish|cichlid|tetra|aquarium pet)\b", "fish"),
            (r"\b(horse|pony|equine|foal)\b", "horse"),
        ]
        detected = "general_pet"
        for pattern, sp in species_map:
            if re.search(pattern, msg):
                detected = sp
                break
        species = detected

    # Detect intent
    intent = "general_care"
    requires_rag = True
    if any(k in msg for k in ["diet", "food", "feed", "nutrition", "calories"]):
        intent = "nutrition"
    elif any(k in msg for k in ["vaccine", "shot", "flea", "tick", "deworm"]):
        intent = "preventive"
    elif any(k in msg for k in ["vomit", "diarrhea", "scratch", "itch", "cough", "limp", "rash", "skin", "ear"]):
        intent = "medical_query"
    elif any(k in msg for k in ["hello", "hi", "hey", "thanks", "thank you", "who are you"]):
        intent = "conversational"
        requires_rag = False

    # Formulate refined search query
    query_for_rag = f"{species} {state['message']}".strip()

    steps.append(f"Question Analysis: Species={species}, Intent={intent}, RequiresRAG={requires_rag}")
    return {
        "pet_species": species,
        "intent": intent,
        "requires_rag": requires_rag,
        "query_for_rag": query_for_rag,
        "processing_steps": steps,
    }

import asyncio
import concurrent.futures

def _run_coroutine_sync(coro):
    """Executes an async coroutine synchronously, handling active or new event loops."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)

def document_retrieval_node(state: VetBotState) -> Dict[str, Any]:
    """
    Step 3: Trusted document retrieval.
    Queries the ChromaDB + BM25 hybrid index for verified veterinary literature.
    """
    steps = state.get("processing_steps", []) + ["Document Retrieval: Hybrid ChromaDB + BM25 retrieval"]
    if not state.get("requires_rag", True):
        steps.append("Document Retrieval: Skipped (Non-clinical query)")
        return {
            "retrieved_passages": [],
            "sources": [],
            "processing_steps": steps,
        }

    query = state.get("query_for_rag") or state["message"]
    req = RetrieveRequest(query=query, top_k=4, min_score=0.25, use_bm25=True)
    try:
        passages = _run_coroutine_sync(retrieve_passages(req))
    except Exception as e:
        logger.warning(f"RAG retrieval sync runner error: {e}")
        passages = []

    formatted_sources = [
        {
            "id": p.id,
            "title": p.source_title,
            "url": p.source_url or "",
            "category": p.category,
            "score": p.score,
            "excerpt": p.text[:160] + "...",
            "text": p.text,
        }
        for p in passages
    ]

    steps.append(f"Document Retrieval: Found {len(formatted_sources)} authoritative clinical passages")
    return {
        "retrieved_passages": [p.model_dump(by_alias=True) for p in passages],
        "sources": formatted_sources,
        "processing_steps": steps,
    }

def answer_generation_node(state: VetBotState) -> Dict[str, Any]:
    """
    Step 4: Evidence-grounded answer generation.
    Synthesizes trusted clinical sources into an empathetic, educational response.
    Explicitly forbids asserting a diagnosis or prescribing medication.
    """
    steps = state.get("processing_steps", []) + ["Answer Generation: Evidence-grounded synthesis"]
    sources = state.get("sources", [])
    pet_species = state.get("pet_species", "pet")
    user_query = state["message"]

    context_str = ""
    if sources:
        context_str = "VETERINARY REFERENCE EXCERPTS:\n"
        for i, s in enumerate(sources, 1):
            context_str += f"[{i}] {s['title']} ({s['category']}):\n{s.get('text', s['excerpt'])}\n\n"

    system_prompt = (
        "You are PetCare AI VetBot, a friendly, knowledgeable, and caring veterinary assistant for ALL pet animals "
        "(dogs, cats, birds, rabbits, guinea pigs, hamsters, ferrets, reptiles, turtles, fish, and horses).\n\n"
        "RESPONSE RULES (SHORT, SWEET & HUMAN-UNDERSTANDABLE):\n"
        "1. BE SHORT & SWEET: Keep your answer under 100-130 words. Pet owners need fast, bite-sized clarity, NOT long textbook essays.\n"
        "2. STRUCTURE:\n"
        "   - First 1-2 sentences: Direct, compassionate answer explaining why this happens in this pet.\n"
        "   - 2-3 Bullet Points: Short, practical next steps the owner can take right now.\n"
        "   - Closing line: A brief tip on when to see the vet.\n"
        "3. NATURAL & CONVERSATIONAL: Speak directly and warmly. No robotic boilerplate (do not say 'Hello there, thank you for reaching out...').\n"
        "4. SAFE & COMPLIANT: Never prescribe drug dosages (no mg/kg) or guarantee a medical diagnosis.\n"
        "5. EVIDENCE-GROUNDED: Base advice on veterinary literature for the specific pet species."
    )

    user_prompt = (
        f"Pet Species: {pet_species}\n"
        f"Owner Question: {user_query}\n\n"
        f"{context_str}\n"
        "Provide a short, sweet, simplified, and practical answer for the pet owner:"
    )

    image_data = state.get("image_data")
    role_to_use = "vision" if image_data else "answer"

    if image_data:
        system_prompt += (
            "\n6. VISUAL INSPECTION: The owner attached a photo. Observe visible surface features (redness, swelling, hair loss, discharge, posture). "
            "Never assert a definitive diagnosis from a photo alone; advise in-person veterinary examination for skin scrapes or palpation."
        )
        human_content = [
            {"type": "text", "text": user_prompt},
            {"type": "image_url", "image_url": {"url": image_data}}
        ]
        human_msg = HumanMessage(content=human_content)
    else:
        human_msg = HumanMessage(content=user_prompt)

    try:
        model = get_chat_model(role=role_to_use, temperature=0.2, max_tokens=850)
        try:
            response = model.invoke([
                SystemMessage(content=system_prompt),
                human_msg,
            ])
        except Exception as vision_err:
            if image_data:
                logger.warning(f"Vision invoke failed ({vision_err}), attempting text-only fallback.")
                fallback_model = get_chat_model(role="answer", temperature=0.2, max_tokens=850)
                response = fallback_model.invoke([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt),
                ])
            else:
                raise vision_err

        draft = response.content if isinstance(response.content, str) else str(response.content)
        if not draft or not draft.strip():
            raise ValueError("Empty response content from LLM")
        steps.append(f"Answer Generation: Model generation successful ({'Multimodal Vision' if image_data else 'Text'})")
    except Exception as e:
        logger.warning(f"Model generation error ({e}), providing resilient clinical fallback.")
        steps.append(f"Answer Generation: Fallback triggered ({str(e)[:40]})")
        if sources:
            draft = (
                f"For {pet_species}s, here is key veterinary advice:\n\n"
                f"- **Key Guidance:** {sources[0].get('text', sources[0]['excerpt'])[:180]}...\n"
                f"- **Immediate Step:** Keep your {pet_species} comfortable, hydrated, and observe closely.\n"
                f"- **Next Action:** Please check with your vet if symptoms continue or worsen."
            )
        else:
            draft = (
                f"For your {pet_species}, keep them in a safe, calm environment with fresh water. "
                f"If symptoms persist or behavior changes, please consult your veterinarian for an in-person checkup."
            )

    return {
        "draft_answer": draft,
        "processing_steps": steps,
    }

def safety_validation_node(state: VetBotState) -> Dict[str, Any]:
    """
    Step 5: Safety validation & non-diagnosis enforcement.
    Audits draft answer for illegal dosage prescriptions or diagnostic assertions,
    and appends mandatory veterinary care disclaimers.
    """
    steps = state.get("processing_steps", []) + ["Safety Validation: Auditing dosage suppression and disclaimers"]
    draft = state.get("draft_answer", "")
    warnings = list(state.get("safety_warnings", []))

    # Audit for unauthorized prescription dosages
    if re.search(r"\b(\d+\.?\d*)\s*(mg\/kg|mg\s*per\s*pound|tablets?\s*of|capsules?\s*of)\b", draft, re.IGNORECASE):
        warnings.append("Unauthorized prescription dosage detected and suppressed.")
        draft = re.sub(
            r"\b(\d+\.?\d*)\s*(mg\/kg|mg\s*per\s*pound|tablets?\s*of|capsules?\s*of)\b",
            "[Dosage suppressed — consult your veterinarian for exact prescription guidelines]",
            draft,
            flags=re.IGNORECASE
        )

    # Short non-diagnostic pet-care note
    disclaimer = "\n\n**Clinical Pet-Care Notice:** _PetCare AI provides educational guidance and cannot replace an in-person veterinary checkup._"

    if "Clinical Pet-Care Notice" not in draft:
        final = draft.strip() + disclaimer
    else:
        final = draft.strip()

    steps.append("Safety Validation: Approved (Disclaimer attached)")
    return {
        "final_answer": final,
        "safety_warnings": warnings,
        "processing_steps": steps,
    }
