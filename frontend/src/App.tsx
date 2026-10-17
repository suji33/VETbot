import React, { useState } from 'react';
import { useChat } from './hooks/useChat';
import { ChatWindow } from './components/ChatWindow';
import { PetsModal } from './components/PetsModal';
import { ArchitectureModal } from './components/ArchitectureModal';
import {
  PawPrintIcon,
  ChatBubbleIcon,
  PetBadgeIcon,
  NetworkNodesIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  XIcon,
} from './components/Icons';

export const App: React.FC = () => {
  const { messages, isLoading, sendChat, startNewConversation } = useChat();

  const [isPetsOpen, setIsPetsOpen] = useState(false);
  const [isArchOpen, setIsArchOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Theme state with local persistence
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('petcare_theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('petcare_theme', next);
  };

  // Sync HTML/body styles for full window theme consistency
  React.useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#0f172a';
    } else {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#080d18';
      document.body.style.color = '#e8eaf0';
    }
  }, [theme]);

  const isLight = theme === 'light';

  return (
    <div className={`flex h-screen h-[100dvh] w-screen overflow-hidden font-sans transition-colors duration-200 ${
      isLight ? 'bg-[#f8fafc] text-slate-900' : 'bg-[#080d18] text-white'
    }`}>
      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-out Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] flex flex-col md:hidden transform transition-transform duration-300 ease-in-out shadow-2xl ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isLight
            ? 'bg-white border-r border-slate-200 text-slate-800'
            : 'bg-[#0b101b] border-r border-[#1a2333] text-white'
        }`}
        aria-label="Mobile Navigation"
      >
        {/* Drawer Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200' : 'border-[#1a2333]'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-md shadow-emerald-950/40">
              <PawPrintIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-sm font-bold tracking-tight leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                PetCare AI
              </h2>
              <p className={`text-[11px] font-normal ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                Veterinary Intelligence
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-[#131926]'
            }`}
            aria-label="Close menu"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button */}
        <div className="p-4">
          <button
            onClick={() => {
              startNewConversation();
              setIsMobileDrawerOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 bg-[#10b981] hover:bg-[#0d9668] active:bg-[#059669] text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all duration-150 shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Consultation</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl border shadow-sm cursor-pointer transition-colors ${
              isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-[#13222d] text-emerald-400 border-emerald-500/25'
            }`}
          >
            <ChatBubbleIcon className={`w-5 h-5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <span>Clinical Chat</span>
          </button>

          <button
            onClick={() => {
              setIsMobileDrawerOpen(false);
              setIsPetsOpen(true);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-gray-300 hover:text-white hover:bg-[#131926]'
            }`}
          >
            <PetBadgeIcon className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
            <span>Pet Profiles</span>
          </button>

          <button
            onClick={() => {
              setIsMobileDrawerOpen(false);
              setIsArchOpen(true);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-gray-300 hover:text-white hover:bg-[#131926]'
            }`}
          >
            <NetworkNodesIcon className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
            <span>AI Architecture</span>
          </button>
        </nav>

        {/* System Status Footer */}
        <div className={`p-4 border-t text-xs space-y-2.5 ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-[#1a2333] text-gray-400'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-2 text-xs font-medium ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
              <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
              <span>PawGuard Safety</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-500 font-semibold text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-2 text-xs font-medium ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
              <DatabaseIcon className="w-4 h-4 text-emerald-500" />
              <span>VetKnowledge RAG</span>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-500 font-semibold text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Connected
            </span>
          </div>
        </div>
      </aside>

      {/* Sidebar for Desktop - SLIM & THIN SHAPE */}
      <aside className={`hidden md:flex flex-col w-56 flex-shrink-0 transition-all duration-200 ${
        isLight
          ? 'bg-white border-r border-slate-200 text-slate-800'
          : 'bg-[#0b101b] border-r border-[#1a2333] text-white'
      }`}>
        {/* App Logo */}
        <div className={`p-3.5 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200' : 'border-[#1a2333]'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#10b981] flex items-center justify-center text-white shadow-sm shadow-emerald-950/40 shrink-0">
              <PawPrintIcon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className={`text-sm font-bold tracking-tight leading-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                PetCare AI
              </h1>
              <p className={`text-[10px] font-normal truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                Veterinary Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Action Button - SLIM */}
        <div className="p-3">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 bg-[#10b981] hover:bg-[#0d9668] active:bg-[#059669] text-white font-semibold py-2 px-3 rounded-lg text-xs transition-all duration-150 shadow-sm cursor-pointer"
            title="Start a new consultation"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Consultation</span>
          </button>
        </div>

        {/* Navigation Modules - COMPACT & CLEAN */}
        <nav className="flex-1 px-2.5 py-1.5 space-y-1 overflow-y-auto">
          <button
            onClick={startNewConversation}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg border shadow-xs cursor-pointer transition-colors ${
              isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-[#13222d] text-emerald-400 border-emerald-500/25'
            }`}
            title="Active clinical consultation"
          >
            <ChatBubbleIcon className={`w-4 h-4 shrink-0 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <span className="truncate">Clinical Chat</span>
          </button>

          <button
            onClick={() => setIsPetsOpen(true)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-gray-300 hover:text-white hover:bg-[#131926]'
            }`}
          >
            <PetBadgeIcon className={`w-4 h-4 shrink-0 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
            <span className="truncate">Pet Profiles</span>
          </button>

          <button
            onClick={() => setIsArchOpen(true)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-gray-300 hover:text-white hover:bg-[#131926]'
            }`}
          >
            <NetworkNodesIcon className={`w-4 h-4 shrink-0 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
            <span className="truncate">AI Architecture</span>
          </button>
        </nav>

        {/* System Status Footer - SLIM */}
        <div className={`p-3 border-t text-[11px] space-y-2 ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-[#1a2333] text-gray-400'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-2 font-medium truncate ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
              <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">PawGuard</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-500 font-semibold text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-2 font-medium truncate ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
              <DatabaseIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">VetKnowledge</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-500 font-semibold text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Online
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Chat Window */}
        <div className="flex-1 h-full overflow-hidden">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            onSend={sendChat}
            onNewChat={startNewConversation}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenPets={() => setIsPetsOpen(true)}
            onOpenArch={() => setIsArchOpen(true)}
            onOpenDrawer={() => setIsMobileDrawerOpen(true)}
          />
        </div>
      </main>

      {/* Modals */}
      <PetsModal isOpen={isPetsOpen} onClose={() => setIsPetsOpen(false)} />
      <ArchitectureModal isOpen={isArchOpen} onClose={() => setIsArchOpen(false)} />
    </div>
  );
};

export default App;

