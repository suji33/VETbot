import React, { useEffect, useRef } from 'react';
import type { Message } from '../hooks/useChat';
import { MessageBubble, TypingIndicator } from './MessageBubble';
import { ChatInput } from './ChatInput';
import {
  PawPrintIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
  StethoscopeIcon,
  HeartPulseIcon,
  BowlIcon,
  SyringeIcon,
  ArrowRightIcon,
  PetBadgeIcon,
  NetworkNodesIcon,
  MenuIcon,
} from './Icons';

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  onSend: (text: string, image?: File) => void;
  onNewChat: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  onOpenPets?: () => void;
  onOpenArch?: () => void;
  onOpenDrawer?: () => void;
}


const QUICK_CARDS = [
  {
    icon: StethoscopeIcon,
    iconColor: 'text-sky-500',
    title: 'My dog has a red patch on its skin',
  },
  {
    icon: HeartPulseIcon,
    iconColor: 'text-rose-500',
    title: 'My pet has not eaten for two days',
  },
  {
    icon: BowlIcon,
    iconColor: 'text-amber-500',
    title: 'What foods are unsafe for dogs?',
  },
  {
    icon: SyringeIcon,
    iconColor: 'text-purple-500',
    title: 'How often should my cat be vaccinated?',
  },
];

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isLoading,
  onSend,
  onNewChat,
  theme = 'dark',
  onToggleTheme,
  onOpenPets,
  onOpenArch,
  onOpenDrawer,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstTime = messages.length === 0;
  const isLight = theme === 'light';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleNewChat = () => {
    onNewChat();
    setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  return (
    <div className={`flex flex-col h-full min-h-0 min-w-0 overflow-hidden transition-colors duration-200 ${
      isLight ? 'bg-[#f8fafc] text-slate-900' : 'bg-[#080d18] text-white'
    }`}>
      {/* Top Header Bar with iOS Notch / Safe Area support */}
      <header className={`flex items-center justify-between px-3 sm:px-8 py-2.5 sm:py-3.5 pt-[calc(0.65rem+env(safe-area-inset-top,0px))] border-b flex-shrink-0 transition-colors duration-200 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#0b101b] border-[#1a2333]'
      }`}>
        {/* Brand identity on left + Mobile Drawer toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onOpenDrawer && (
            <button
              onClick={onOpenDrawer}
              className={`md:hidden p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-gray-300 hover:bg-[#131926]'
              }`}
              title="Open Navigation Menu"
              aria-label="Open navigation menu"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          )}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-md shadow-emerald-950/40 flex-shrink-0">
            <PawPrintIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div>
            <h1 className={`text-xs sm:text-sm font-bold tracking-tight leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              PetCare AI
            </h1>
            <p className={`text-[9.5px] sm:text-[11px] font-normal ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
              Veterinary Intelligence
            </p>
          </div>
        </div>

        {/* Right Header Controls: New Chat, Modals, Theme Toggle, Profile */}
        <div className="flex items-center gap-1 sm:gap-2.5">
          {/* Quick Pet Profiles Button */}
          {onOpenPets && (
            <button
              onClick={onOpenPets}
              className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-gray-400 hover:bg-[#131926]'
              }`}
              title="Pet Profiles"
              aria-label="Pet Profiles"
            >
              <PetBadgeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Quick AI Architecture Button */}
          {onOpenArch && (
            <button
              onClick={onOpenArch}
              className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
                isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-gray-400 hover:bg-[#131926]'
              }`}
              title="AI Architecture"
              aria-label="AI Architecture"
            >
              <NetworkNodesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Header New Chat Button (visible during active consultation) */}
          {!isFirstTime && (
            <button
              onClick={handleNewChat}
              className={`flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-lg transition-all shadow-xs cursor-pointer ${
                isLight
                  ? 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-slate-200/50'
                  : 'border border-[#1e2638] hover:border-emerald-500/50 bg-[#0d1322] text-gray-200 hover:text-white'
              }`}
              title="Start a new chat session"
            >
              <span className="text-emerald-500 font-bold text-sm leading-none">+</span>
              <span className="hidden xs:inline">New chat</span>
            </button>
          )}

          {/* Theme Switcher Button */}
          <button
            onClick={onToggleTheme}
            className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 ring-1 ring-slate-200'
                : 'text-gray-400 hover:text-gray-100 hover:bg-[#131926] ring-1 ring-white/10'
            }`}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle theme mode"
          >
            {isLight ? (
              <MoonIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-600" />
            ) : (
              <SunIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 hover:text-amber-300" />
            )}
          </button>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-1 pl-0.5 cursor-pointer">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[11px] sm:text-xs font-bold shadow-xs">
              P
            </div>
            <ChevronDownIcon className={`w-3 h-3 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
          </div>
        </div>
      </header>

      {/* Main Content / Chat Stream Area - MUST HAVE min-h-0 so ChatInput is never pushed off */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-8 lg:px-12 py-3 sm:py-5 flex flex-col">
        {isFirstTime ? (
          /* Empty / Welcome Hero State - Compact for mobile viewports */
          <div className="flex flex-col items-center justify-center my-auto w-full max-w-3xl mx-auto py-1 sm:py-4 animate-fade-in relative">
            {/* New chat button on top right of content */}
            <div className="w-full flex justify-end mb-1 sm:mb-2">
              <button
                onClick={handleNewChat}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg transition-all shadow-xs cursor-pointer ${
                  isLight
                    ? 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-slate-200/50'
                    : 'border border-[#1e2638] hover:border-emerald-500/50 bg-[#0d1322] text-gray-200 hover:text-white'
                }`}
                title="Start a new chat session"
              >
                <span className="text-emerald-500 font-bold text-xs leading-none">+</span>
                <span>New chat</span>
              </button>
            </div>

            {/* Hero Image Graphic - COMPACT ON MOBILE TO PREVENT OVERFLOW */}
            <div className="relative mb-2 sm:mb-3 flex items-center justify-center">
              <img
                src="/hero-pets.png"
                alt="Golden Retriever Dog and Tabby Cat"
                className="w-28 sm:w-44 md:w-64 lg:w-72 max-h-[110px] sm:max-h-[180px] object-contain select-none"
              />
            </div>

            {/* Hero Typography */}
            <h2 className={`text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-center leading-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              Clinical <span className="text-[#10b981]">PetCare AI</span>
            </h2>
            <p className={`text-xs sm:text-sm md:text-base mt-1 mb-3 sm:mb-5 text-center font-normal max-w-md px-2 ${
              isLight ? 'text-slate-600' : 'text-gray-300'
            }`}>
              Understand your pet's health with clear, evidence-based guidance.
            </p>

            {/* Suggestion Cards Grid - COMPACT ON MOBILE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full">
              {QUICK_CARDS.map((card, idx) => {
                const IconComponent = card.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => onSend(card.title)}
                    className={`flex items-center justify-between p-2.5 sm:p-4 rounded-xl transition-all duration-150 text-left group shadow-xs hover:shadow-sm cursor-pointer min-h-[46px] sm:min-h-[62px] ${
                      isLight
                        ? 'bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500/60 text-slate-800'
                        : 'bg-[#0e1424] hover:bg-[#131b2e] border border-[#1c2538] hover:border-emerald-500/40 text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-1">
                      <IconComponent className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${card.iconColor}`} />
                      <span className={`text-xs sm:text-sm font-medium leading-snug line-clamp-2 ${
                        isLight ? 'text-slate-800 group-hover:text-emerald-700' : 'text-gray-200 group-hover:text-white'
                      }`}>
                        {card.title}
                      </span>
                    </div>
                    <ArrowRightIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-all group-hover:translate-x-1 ${
                      isLight ? 'text-slate-400 group-hover:text-emerald-600' : 'text-gray-500 group-hover:text-emerald-400'
                    }`} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Active Chat Stream */
          <div className="space-y-3.5 sm:space-y-5 max-w-4xl w-full mx-auto py-1 sm:py-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} theme={theme} />
            ))}
            {isLoading && <TypingIndicator theme={theme} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Floating Pill Input Bar - Flex-shrink-0 so always docked at bottom */}
      <div className="flex-shrink-0 z-20">
        <ChatInput onSend={onSend} isLoading={isLoading} theme={theme} inputRef={inputRef} />
      </div>
    </div>
  );
};
