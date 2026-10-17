import React from 'react';
import { NetworkNodesIcon, XIcon } from './Icons';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-border bg-surface-card">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="p-2 bg-brand-950/60 border border-brand-700/60 rounded-xl text-brand-400 shrink-0">
              <NetworkNodesIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-white truncate">System Architecture</h2>
              <p className="text-[11px] sm:text-xs text-brand-400 truncate">Multi-Model Pipeline • RAG + NLP • ChromaDB</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 text-xs text-gray-300">
          {/* Pipeline flow */}
          <div>
            <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span>
              Execution Flow
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-surface-bg border border-surface-border rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-red-400">1. PawGuard (Safety Gate)</span>
                  <span className="text-[10px] bg-red-950/60 border border-red-700/60 text-red-300 px-1.5 py-0.5 rounded">Deterministic</span>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  Regex & rule matching for 13+ emergency conditions (bloat, breathing difficulty, poisoning) and prompt injection before any LLM is called.
                </p>
              </div>

              <div className="bg-surface-bg border border-surface-border rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-400">2. PetMind NLP (Intent & Entities)</span>
                  <span className="text-[10px] bg-blue-950/60 border border-blue-700/60 text-blue-300 px-1.5 py-0.5 rounded">LLM #1 Fast</span>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  Extracts pet species, age, symptoms, emergency flags, and clinical intent (medical, nutrition, care, toxicity).
                </p>
              </div>

              <div className="bg-surface-bg border border-surface-border rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-400">3. PawVision (Vision AI)</span>
                  <span className="text-[10px] bg-purple-950/60 border border-purple-700/60 text-purple-300 px-1.5 py-0.5 rounded">Vision Model</span>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  Multimodal inspection of skin lesions, eyes, wounds, or diet labels. Outputs descriptive veterinary observations, strictly avoiding diagnosis.
                </p>
              </div>

              <div className="bg-surface-bg border border-surface-border rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">4. VetKnowledge RAG</span>
                  <span className="text-[10px] bg-amber-950/60 border border-amber-700/60 text-amber-300 px-1.5 py-0.5 rounded">ChromaDB + Embeddings</span>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  Vector similarity search over verified veterinary clinical textbooks and manuals. Returns source-attributed excerpts.
                </p>
              </div>

              <div className="bg-surface-bg border border-surface-border rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">5. VetSage (Grounded Synthesis)</span>
                  <span className="text-[10px] bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 px-1.5 py-0.5 rounded">LLM #2 Core</span>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  Synthesizes retrieved clinical passages, vision findings, and pet profiles into empathetic, cautious, evidence-grounded answers.
                </p>
              </div>

              <div className="bg-surface-bg border border-surface-border rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pink-400">6. PawVerify (Conditional Reviewer)</span>
                  <span className="text-[10px] bg-pink-950/60 border border-pink-700/60 text-pink-300 px-1.5 py-0.5 rounded">LLM #3 Dual-Model</span>
                </div>
                <p className="text-gray-400 leading-relaxed">
                  Invoked dynamically only on high-risk queries (medication doses, potential cancer/parvo) to ensure strict safety and zero hallucination.
                </p>
              </div>
            </div>
          </div>

          {/* Model Registry & DB */}
          <div>
            <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Tech Stack & Storage
            </h3>
            <div className="bg-surface-bg border border-surface-border rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-gray-500 text-[11px]">Primary Database</p>
                <p className="text-white font-medium">MongoDB Atlas</p>
                <p className="text-[10px] text-gray-400">Conversations, Multi-Turn Context, Pets</p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Vector Database</p>
                <p className="text-white font-medium">ChromaDB + BM25</p>
                <p className="text-[10px] text-gray-400">Veterinary Knowledge Embeddings</p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">LLM Gateway</p>
                <p className="text-white font-medium">Gemini 3.5 + OpenRouter</p>
                <p className="text-[10px] text-gray-400">Multimodal Vision & Clinical Reasoning</p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Continuous Learning</p>
                <p className="text-white font-medium">AutoTrainer Engine</p>
                <p className="text-[10px] text-gray-400">Auto-syncs clinical corpus & consultation feedback</p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Backend API</p>
                <p className="text-white font-medium">Node.js + Express + Zod</p>
                <p className="text-[10px] text-gray-400">TypeScript strict mode</p>
              </div>
              <div>
                <p className="text-gray-500 text-[11px]">Frontend Client</p>
                <p className="text-white font-medium">React 19 + Tailwind CSS</p>
                <p className="text-[10px] text-gray-400">Vite + TypeScript</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
