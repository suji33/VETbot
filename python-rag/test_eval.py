import asyncio
import httpx
import json

async def run_evaluation():
    print("=" * 60)
    print("[VETbot] Python NLP & RAG Comprehensive Evaluation")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=45.0) as client:
        # 1. Health check
        res = await client.get("http://localhost:8002/health")
        print(f"\n[1/4] Health Check (http://localhost:8002/health):")
        print(f"  Status: {res.status_code}")
        health_data = res.json()
        print(f"  Service: {health_data['service']}")
        print(f"  ChromaDB: {health_data['rag']}")

        # 2. NLP Extraction Test
        nlp_test_cases = [
            {
                "name": "Dermatology / Symptoms",
                "message": "My golden retriever has circular red patches on his skin with hair loss and scabs for 3 days.",
                "expected_species": "dog",
                "expected_intent": "symptom_information",
            },
            {
                "name": "Nutrition Question",
                "message": "What is the recommended protein percentage for an adult dog according to AAFCO?",
                "expected_species": "dog",
                "expected_intent": "nutrition_question",
            },
            {
                "name": "Emergency Symptom",
                "message": "My dog has sudden severe abdominal bloat and is retching unproductively and pale gums!",
                "expected_species": "dog",
                "expected_intent": "emergency",
            },
        ]

        print(f"\n[2/4] Testing PetMind NLP Microservice (/nlp/analyze):")
        for tc in nlp_test_cases:
            res = await client.post("http://localhost:8002/nlp/analyze", json={
                "message": tc["message"],
                "hasImage": False,
            })
            data = res.json()
            print(f"\n  * Test Case: {tc['name']}")
            print(f"    Input: \"{tc['message'][:65]}...\"")
            print(f"    Detected Intent: {data.get('intent')} (confidence: {data.get('confidence')})")
            print(f"    Detected Species: {data.get('petSpecies')}")
            print(f"    Extracted Symptoms: {data.get('symptoms')}")
            print(f"    Requires RAG: {data.get('requiresRag')}")

        # 3. RAG Retrieval Test
        rag_test_cases = [
            {
                "name": "Chocolate Toxicology",
                "query": "dog ate dark chocolate theobromine toxicity",
                "category": "toxicology",
            },
            {
                "name": "Feline Nutrition Taurine",
                "query": "essential taurine amino acid deficiency in cats",
                "category": "nutrition",
            },
            {
                "name": "Canine Dermatology Allergy",
                "query": "canine allergic dermatitis pruritus and itching",
                "category": "dermatology",
            },
            {
                "name": "Unrelated Query (Safety Check)",
                "query": "astronomy black holes quantum mechanics",
                "category": None,
            },
        ]

        print(f"\n[3/4] Testing VetKnowledge RAG Microservice (/rag/retrieve):")
        for tc in rag_test_cases:
            res = await client.post("http://localhost:8002/rag/retrieve", json={
                "query": tc["query"],
                "filterCategory": tc["category"],
                "topK": 3,
                "minScore": 0.3,
                "useBm25": True,
            })
            passages = res.json()
            print(f"\n  * Query: \"{tc['query']}\"")
            print(f"    Retrieved Passages: {len(passages)}")
            for idx, p in enumerate(passages):
                print(f"      {idx+1}. [{p.get('category')}] Score: {p.get('score')} | Source: {p.get('sourceTitle')}")
                print(f"         Text: {p.get('text')[:120]}...")

        # 4. End-to-end Backend Chat Integration Test
        print(f"\n[4/4] Testing End-to-End Chat via Node.js Backend (http://localhost:3001/api/chat):")
        chat_res = await client.post("http://localhost:3001/api/chat", json={
            "sessionId": "eval-session-python",
            "message": "My dog ate baker's chocolate an hour ago and is vomiting. What are the signs of theobromine toxicity and what should I do?",
        })
        print(f"  Backend HTTP Status: {chat_res.status_code}")
        chat_data = chat_res.json()
        print(f"  Processing Steps:")
        for s in chat_data.get("processingSteps", []):
            safe_s = s.encode('ascii', 'replace').decode('ascii')
            print(f"    - {safe_s}")
        print(f"  Citations Returned ({len(chat_data.get('sources', []))}):")
        for src in chat_data.get("sources", []):
            print(f"    * {src.get('title')}: {src.get('url')}")
        safe_ans = chat_data.get('answer', '')[:350].encode('ascii', 'replace').decode('ascii')
        print(f"\n  Answer Excerpt:\n{safe_ans}...\n")

if __name__ == "__main__":
    asyncio.run(run_evaluation())
