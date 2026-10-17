# 🐾 PetCare AI — Enterprise Veterinary Clinical Intelligence Platform  the bot hosting on this link: https://ve-tbot.vercel.app

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas_Cloud-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.8_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-FF6B6B)](https://www.trychroma.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **A production-grade, multi-model clinical veterinary guidance and pet triage platform. Built with deterministic safety gates, multimodal computer vision inspection, hybrid dense + BM25 semantic retrieval (RAG), and dual-model hallucination auditing.**

---

## 📌 Executive Overview

**PetCare AI** is designed to address the critical risks of deploying generative AI in animal health. Naive single-prompt chatbots frequently hallucinate, miss acute life-threatening emergencies, output unsafe human medication dosages, or deliver misleading medical diagnoses.

PetCare AI solves this through a decoupled, multi-stage pipeline:
1. **Deterministic Safety Rules First**: Catches bloat (GDV), severe bleeding, and toxin ingestions with zero latency before any LLM inference occurs.
2. **Specialized NLP Entity & Intent Extraction**: Identifies pet species, age, symptoms, and urgency level.
3. **Multimodal Vision Inspection (PawVision)**: Analyzes photos of skin patches, eyes, or wounds for visible patterns while strictly avoiding premature diagnoses.
4. **Hybrid Veterinary Knowledge RAG**: Combines semantic embeddings with BM25 lexical keyword matching over verified veterinary textbooks and clinical manuals.
5. **Calibrated Clinical Synthesis (VetSage)**: Generates clear, compassionate, and non-repetitive guidance grounded directly in retrieved clinical passages.
6. **Dual-Model Audit (PawVerify)**: Performs secondary medical safety verification on high-risk clinical advice.
7. **Persistent Patient Memory**: Automatically links conversation history and registered pet profiles in MongoDB Atlas.

---

## 🧬 Architectural Pipeline: How NLP, RAG, and LLMs Connect

The following sequence illustrates how every message flows through the system:

```
                      ┌──────────────────────────────────────────────┐
                      │    User Input: Text Query + Optional Photo   │
                      └──────────────────────┬───────────────────────┘
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │    Stage 1: PawGuard Deterministic Gate      │
                      │  • 13+ Acute Emergency Regex Patterns        │
                      │  • Jailbreak & Prompt-Injection Filter       │
                      └──────┬────────────────────────────────┬──────┘
                             │ (Emergency Detected)           │ (Safety Passed)
                             ▼                                ▼
            ┌───────────────────────────────────┐    ┌──────────────────────────────────┐
            │ 🚨 Immediate Clinical Triage      │    │  Stage 2: PetMind NLP Module     │
            │ • Zero LLM latency                │    │  • Intent Detection              │
            │ • Emergency referral protocols    │    │  • Species & Symptom Extraction  │
            └───────────────────────────────────┘    └────────────────┬─────────────────┘
                                                                      │
                                                ┌─────────────────────┴────────────────────┐
                                                │ (If Photo Attached)                      │
                                                ▼                                          │
                               ┌─────────────────────────────────┐                         │
                               │  Stage 3: PawVision Multimodal  │                         │
                               │  • Google Gemini 3.8 / GPT-4o   │                         │
                               │  • Observable lesion features   │                         │
                               └────────────────┬────────────────┘                         │
                                                │                                          │
                                                ▼                                          ▼
                               ┌───────────────────────────────────────────────────────────┐
                               │       Stage 4: VetKnowledge Hybrid RAG Retrieval          │
                               │  • Dense Vector Similarity Search (ChromaDB)              │
                               │  • BM25 Lexical Keyword Ranking (Textbooks & Manuals)     │
                               │  • Filtered Clinical Passages with Source Attributions   │
                               └────────────────────────────┬──────────────────────────────┘
                                                            │
                                                            ▼
                               ┌───────────────────────────────────────────────────────────┐
                               │         Stage 5: VetSage Grounded Synthesis Engine        │
                               │  • Google Gemini 3.8 Flash / OpenRouter Gateway           │
                               │  • Structured Clinical Synthesis from Evidence            │
                               │  • Strict Non-Diagnostic & Safety Disclaimer Formatting   │
                               └────────────────────────────┬──────────────────────────────┘
                                                            │
                                                ┌───────────┴─────────────┐
                                                │ (High-Risk Query?)      │ (Standard Query)
                                                ▼                         │
                               ┌─────────────────────────────────┐        │
                               │ Stage 6: PawVerify Safety Audit │        │
                               │ • Secondary Model Cross-Check   │        │
                               │ • Dosage & Claim Verification   │        │
                               └────────────────┬────────────────┘        │
                                                │                         │
                                                ▼                         ▼
                               ┌───────────────────────────────────────────────────────────┐
                               │           Stage 7: Context Persistence & Client           │
                               │  • Multi-turn Session Memory saved to MongoDB Atlas       │
                               │  • React 19 Frontend with Verified Literature Citations   │
                               └───────────────────────────────────────────────────────────┘
```

### Deep Dive: The NLP ➔ RAG ➔ LLM Synergy

1. **Natural Language Processing (NLP)**:
   - When the user sends a message like *"My 2-year-old golden retriever has a red rash on his belly"*, the NLP layer extracts:
     - `species`: Dog
     - `breed`: Golden Retriever
     - `age`: 2 years
     - `symptoms`: `["red rash", "belly lesion"]`
     - `intent`: `symptom_information`
     - `urgency`: `moderate`
   - This metadata is injected into the subsequent search queries and model system prompts.

2. **Retrieval-Augmented Generation (RAG)**:
   - Using the extracted entities, the RAG engine formulates a targeted query against the vector database (ChromaDB):
     - Dense vector embedding matches semantic meaning (*"allergic dermatitis in canines"*).
     - BM25 lexical ranking matches exact terminology (*"rash"*, *"dermatitis"*, *"canine"*).
   - Only the highest-scoring, vetted clinical excerpts are passed forward, preventing hallucination.

3. **Large Language Model (LLM) Synthesis**:
   - The LLM receives:
     - The user's query
     - Multi-turn conversation context
     - Registered pet profile details
     - Multimodal vision observations (if a photo was uploaded)
     - The retrieved veterinary literature excerpts
   - The model synthesizes an evidence-grounded response following strict clinical communication guidelines, providing practical home care steps, warning signs, and transparent citations.

---

## 📂 Project Directory Structure

```text
VETbot/
├── backend/                  # Node.js + Express + TypeScript Orchestrator API
│   ├── src/
│   │   ├── adapters/         # ModelAdapter (Gemini 3.8 Flash & OpenRouter gateway)
│   │   ├── db/               # MongoDB Atlas connection & Mongoose schemas
│   │   ├── modules/          # Core pipeline modules:
│   │   │   ├── PawGuard.ts          # Deterministic safety & injection filters
│   │   │   ├── PetMindNLP.ts        # Intent & entity extraction
│   │   │   ├── PawVision.ts         # Multimodal computer vision analysis
│   │   │   ├── VetKnowledgeRAG.ts   # Semantic vector & keyword retrieval
│   │   │   ├── VetSage.ts           # Evidence-grounded synthesis & local fallback
│   │   │   └── PawVerify.ts         # Dual-model clinical reviewer
│   │   ├── orchestrator/     # PawOrchestrator coordination engine
│   │   ├── routes/           # REST endpoints (/api/chat, /api/pets, /api/reminders)
│   │   └── server.ts         # Express server bootstrap
│   ├── .env.example          # Sanitized backend configuration template
│   └── package.json
│
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind CSS Web Client
│   ├── src/
│   │   ├── components/       # UI Components:
│   │   │   ├── ChatWindow.tsx        # Main consultation interface & hero cards
│   │   │   ├── ChatInput.tsx         # Pill input with attachment support
│   │   │   ├── MessageBubble.tsx     # Markdown streaming & clinical formatters
│   │   │   ├── PetsModal.tsx         # Pet profile management (MongoDB-synced)
│   │   │   ├── ArchitectureModal.tsx # Interactive pipeline architecture visualizer
│   │   │   ├── SourceCard.tsx        # Verifiable veterinary literature citations
│   │   │   └── Icons.tsx             # Custom SVG icon set
│   │   ├── hooks/            # useChat session and message streaming hook
│   │   ├── api/              # Axios client with session tracking
│   │   ├── App.tsx           # Responsive layout with mobile slide-out drawer
│   │   └── index.css         # Tailwind base & dynamic viewport height rules
│   ├── index.html            # Web App meta tags & viewport configurations
│   ├── .env.example          # Frontend configuration template
│   └── package.json
│
├── python-rag/               # Optional Python FastAPI NLP & Hybrid RAG Microservice
│   ├── app/
│   │   ├── graph/            # LangGraph workflow graphs & nodes
│   │   ├── llm/              # LangChain chat model providers
│   │   ├── nlp/              # PetMind NLP analyzer
│   │   ├── rag/              # ChromaDB vector retriever & BM25 ranking
│   │   ├── config.py         # Microservice settings (Gemini 3.8 default)
│   │   └── main.py           # FastAPI application
│   ├── .env.example          # Microservice environment template
│   └── requirements.txt
│
├── deep-agent/               # Autonomous Veterinary Deep Research Agent
│   └── agent.py              # Standalone research agent using deepagents framework
│
├── .gitignore                # Root git exclusion rules (secrets, node_modules, cache)
└── README.md                 # System documentation & technical guide
```

---

## 🔒 Git Hygiene: What to Push vs. What NOT to Push

Before pushing this repository to GitHub or sharing it with team members, ensure strict credential security:

### ✅ MUST PUSH (Safe & Required for Deployment)
- Source code files (`.ts`, `.tsx`, `.py`, `.json`, `.css`, `.html`).
- Configuration templates:
  - `backend/.env.example`
  - `frontend/.env.example`
  - `python-rag/.env.example`
- Configuration files (`package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`).
- Documentation (`README.md`, asset images in `frontend/public/`).
- Repository `.gitignore` files.

### 🚫 DO NOT PUSH (Strictly Excluded via `.gitignore`)
| File / Directory | Reason for Exclusion |
| :--- | :--- |
| `**/.env`, `**/.env.local` | **Contains real API keys (Google Gemini, OpenRouter, MongoDB password).** |
| `**/node_modules/` | Heavy dependencies (re-installed with `npm install`). |
| `**/dist/`, `**/build/` | Production bundles generated dynamically during CI/CD. |
| `**/__pycache__/`, `**/.pytest_cache/` | Python bytecode and temporary test caches. |
| `**/chroma_db_data/`, `*.sqlite3` | Local database binaries (re-indexed with `npm run ingest`). |
| `**/.vscode/`, `**/.idea/` | Local user editor and IDE preferences. |
| `**/.agents/` | Local AI agent conversation trajectory logs. |

---

## 🚀 Quickstart & Installation Guide

### 1. Prerequisites
- **Node.js**: v18.x or v20.x
- **Python** (Optional, for `python-rag`): 3.10+
- **MongoDB Atlas**: Free cluster URL or local MongoDB instance

### 2. Configure Environment Variables
Copy the `.env.example` templates to `.env` in both `backend` and `frontend`:

```bash
# In backend/
cp backend/.env.example backend/.env

# In frontend/
cp frontend/.env.example frontend/.env
```

Open `backend/.env` and insert your credentials:
```env
PORT=3001
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/petcareai?retryWrites=true&w=majority
GOOGLE_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_key
```

### 3. Run the Backend API
```bash
cd backend
npm install
npm run build    # Validates TypeScript compilation
npm run dev      # Starts API on http://localhost:3001
```

### 4. Run the Frontend Client
```bash
cd frontend
npm install
npm run dev      # Starts client on http://localhost:5173
```

Visit **[http://localhost:5173](http://localhost:5173)** in your browser or mobile device.

### 5. (Optional) Run the Python RAG Microservice
```bash
cd python-rag
pip install -r requirements.txt
python run.py    # Starts microservice on http://localhost:8002
```

---

## 🧪 Testing & Verification

Run automated safety, injection, and pipeline unit tests:

```bash
# Backend unit & PawGuard safety tests
cd backend
npm test

# Python RAG microservice tests
cd python-rag
pytest tests/
```

---

## 📱 Mobile-First Features

- **Dynamic Viewport Height (`100dvh`)**: Immune to iOS Safari and mobile Chrome bottom bar jumpiness.
- **Slide-out Navigation Drawer**: Touch-friendly hamburger menu for quick access to consultations, pet profiles, and architecture views on phones.
- **Zero-Error Fallback Engine**: If any upstream LLM service reaches daily quota limits, the local Grounded Clinical Synthesis Engine automatically provides accurate, structured veterinary advice so users never experience a 500/429 error screen.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
