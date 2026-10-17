import React, { useState, useEffect } from 'react';
import type { Message } from '../hooks/useChat';
import { SourceCard } from './SourceCard';
import { BotIcon, UserIcon, AlertTriangleIcon } from './Icons';

interface MessageBubbleProps {
  message: Message;
  theme?: 'dark' | 'light';
}

// Typing dots animation for loading state
export const TypingIndicator: React.FC<{ theme?: 'dark' | 'light' }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm shadow-brand-900/30">
        <BotIcon className="w-4 h-4" />
      </div>
      <div className={`flex gap-1.5 items-center py-4 px-5 rounded-2xl rounded-bl-sm border ${
        isLight
          ? 'bg-white border-slate-200 shadow-md shadow-slate-200/50'
          : 'bg-[#101625] border-[#1e2638] shadow-lg shadow-black/40'
      }`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-brand-400"
            style={{ animation: `pulseDot 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, theme = 'dark' }) => {
  const isUser = message.role === 'user';
  const isLight = theme === 'light';

  // Word-by-word streaming effect for newly arrived AI messages
  const [displayedLength, setDisplayedLength] = useState<number>(() => {
    // If message is older than 8 seconds, display immediately in full
    const ageMs = Date.now() - new Date(message.timestamp).getTime();
    return isUser || ageMs > 8000 ? message.content.length : 0;
  });

  const isStreaming = !isUser && displayedLength < message.content.length;

  useEffect(() => {
    if (isUser || displayedLength >= message.content.length) return;

    // Stream words progressively at high cadence
    const interval = setInterval(() => {
      setDisplayedLength((prev) => {
        const next = prev + 12; // Advance characters in smooth chunks
        if (next >= message.content.length) {
          clearInterval(interval);
          return message.content.length;
        }
        return next;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [isUser, message.content.length, displayedLength]);

  const activeContent = isUser ? message.content : message.content.slice(0, displayedLength);

  // Skip streaming on click
  const handleBubbleClick = () => {
    if (isStreaming) {
      setDisplayedLength(message.content.length);
    }
  };

  // Structured clinical renderer with section highlights, quotes, and bullets
  const renderClinicalContent = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Empty lines
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      // Section Header 1: What might be happening?
      if (trimmed.includes('What might be happening?')) {
        return (
          <div key={idx} className="mt-3.5 mb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            <h4 className={`text-[16px] font-bold tracking-tight ${
              isLight ? 'text-teal-700' : 'text-teal-300'
            }`}>
              What might be happening?
            </h4>
          </div>
        );
      }

      // Section Header 2: What should I do now?
      if (trimmed.includes('What should I do now?')) {
        return (
          <div key={idx} className="mt-4 mb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h4 className={`text-[16px] font-bold tracking-tight ${
              isLight ? 'text-emerald-700' : 'text-emerald-300'
            }`}>
              What should I do now?
            </h4>
          </div>
        );
      }

      // Section Header 3: When should I contact a veterinarian?
      if (trimmed.includes('When should I contact a veterinarian?')) {
        return (
          <div key={idx} className="mt-4 mb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <h4 className={`text-[16px] font-bold tracking-tight ${
              isLight ? 'text-amber-800' : 'text-amber-300'
            }`}>
              When should I contact a veterinarian?
            </h4>
          </div>
        );
      }

      // Blockquotes or Highlight Callouts (e.g., > **Veterinary Tip:** ...)
      if (trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '');
        return (
          <div key={idx} className={`flex items-start gap-2.5 my-2.5 pl-4 py-2.5 border-l-4 rounded-r-xl ${
            isLight
              ? 'border-amber-500 bg-amber-50 text-amber-900'
              : 'msg-quote'
          }`}>
            <span className="text-amber-500 font-serif text-lg leading-none select-none">“</span>
            <div className={`flex-1 font-medium ${isLight ? 'text-amber-900' : 'text-amber-100'}`}>
              {renderInlineSpans(quoteText)}
            </div>
          </div>
        );
      }

      // Disclaimer footer (_..._)
      if (trimmed.startsWith('_') && trimmed.endsWith('_')) {
        const disclaimer = trimmed.slice(1, -1);
        return (
          <div key={idx} className={`mt-4 pt-3 border-t text-[12.5px] italic flex items-center gap-2 ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-surface-border/50 text-gray-400/90'
          }`}>
            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{disclaimer}</span>
          </div>
        );
      }

      // Markdown headers (### or ##)
      if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
        const headerText = trimmed.replace(/^#+\s*/, '');
        return (
          <h4 key={idx} className={`text-[16px] font-bold tracking-tight mt-3 mb-1.5 ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            {renderInlineSpans(headerText)}
          </h4>
        );
      }

      // Numbered lists (1. , 2. )
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        const num = numMatch[1];
        const numText = numMatch[2];
        return (
          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-1">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 ${
              isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
            }`}>
              {num}
            </span>
            <div className={`flex-1 text-[15.5px] leading-[1.65] ${
              isLight ? 'text-slate-700' : 'text-gray-200'
            }`}>
              {renderInlineSpans(numText)}
            </div>
          </div>
        );
      }

      // Bullet points (- or *)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.slice(2);
        return (
          <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0"></span>
            <div className={`flex-1 text-[15.5px] leading-[1.65] ${
              isLight ? 'text-slate-700' : 'text-gray-200'
            }`}>
              {renderInlineSpans(bulletText)}
            </div>
          </div>
        );
      }

      // Standard paragraph
      return (
        <p key={idx} className={`text-[15.5px] leading-[1.7] my-1 ${
          isLight ? 'text-slate-700' : 'text-gray-200'
        }`}>
          {renderInlineSpans(line)}
        </p>
      );
    });
  };

  // Helper to format inline bold, quotes, and punctuation
  const renderInlineSpans = (raw: string) => {
    // Split by bold (**bold**) and double quotes ("quoted phrase")
    const parts = raw.split(/(\*\*[^*]+\*\*|"[^"]+")/g);

    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('"') && part.endsWith('"') && part.length > 2) {
        return (
          <span key={i} className={`font-medium px-1 py-0.5 rounded border ${
            isLight
              ? 'text-emerald-800 bg-emerald-50 border-emerald-300/80'
              : 'text-brand-300 bg-brand-950/40 border-brand-800/40'
          }`}>
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end animate-slide-up">
        <div className="flex flex-col items-end gap-1 max-w-[80%]">
          {message.imagePreview && (
            <img
              src={message.imagePreview}
              alt="Uploaded for veterinary inspection"
              className={`max-w-[260px] max-h-[220px] object-cover rounded-xl border mb-1.5 shadow-md ${
                isLight ? 'border-slate-300 shadow-slate-200/50' : 'border-surface-border shadow-black/40'
              }`}
            />
          )}
          <div className="msg-user">{message.content}</div>
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${
          isLight ? 'bg-slate-200 text-slate-700' : 'bg-gray-700 text-gray-300'
        }`}>
          <UserIcon className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div className="w-8 h-8 rounded-xl bg-[#10b981] flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-md shadow-emerald-950/40">
        <BotIcon className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col min-w-0 max-w-[88%]">
        {message.isEmergency && (
          <div className="bg-red-950/50 border border-red-700/70 rounded-xl px-3.5 py-2.5 mb-2.5 text-red-200 text-xs font-semibold flex items-center gap-2 shadow-sm shadow-red-950/30">
            <AlertTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
            <span>URGENT EMERGENCY: Immediate veterinary care is strongly advised!</span>
          </div>
        )}
        <div
          onClick={handleBubbleClick}
          className={`rounded-2xl rounded-bl-sm px-6 py-5 max-w-[92%] text-[16px] sm:text-[16.5px] leading-[1.75] transition-colors border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800 shadow-md shadow-slate-200/60'
              : 'bg-[#101625] border-[#1e2638] text-gray-100 shadow-lg shadow-black/40'
          } ${message.isEmergency ? 'border-red-600' : ''} ${isStreaming ? 'cursor-pointer' : ''}`}
          title={isStreaming ? 'Click to show all text immediately' : undefined}
        >
          <div className={`prose max-w-none ${isLight ? '' : 'prose-invert'}`}>
            {renderClinicalContent(activeContent)}
            {isStreaming && <span className="typewriter-cursor" />}
          </div>
        </div>

        {/* Display genuine veterinary clinical references when complete */}
        {!isStreaming && message.sources && message.sources.length > 0 && (
          <div className="ml-1">
            <SourceCard sources={message.sources} theme={theme} />
          </div>
        )}

        <span className={`text-xs mt-1.5 ml-1 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};
