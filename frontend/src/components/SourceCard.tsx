import React, { useState } from 'react';

interface SourceCardProps {
  sources: Array<{ title: string; url?: string; excerpt: string }>;
  theme?: 'dark' | 'light';
}

export const SourceCard: React.FC<SourceCardProps> = ({ sources, theme = 'dark' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!sources || sources.length === 0) return null;
  const isLight = theme === 'light';

  return (
    <div className={`mt-3.5 space-y-2 border-t pt-3 ${
      isLight ? 'border-slate-200' : 'border-surface-border/60'
    }`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
          isLight ? 'text-emerald-700' : 'text-brand-400'
        }`}>
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Verified Veterinary Clinical References ({sources.length})
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-[10px] underline underline-offset-2 transition-colors cursor-pointer ${
            isLight ? 'text-slate-500 hover:text-slate-800' : 'text-gray-400 hover:text-white'
          }`}
        >
          {isExpanded ? 'Show less' : 'Read full excerpt details'}
        </button>
      </div>

      <div className="space-y-2">
        {sources.map((src, i) => (
          <div key={i} className={`rounded-xl p-3 border transition-all ${
            isLight
              ? 'bg-slate-50/80 border-slate-200 shadow-sm'
              : 'source-card bg-surface-bg/70 border-surface-border/90'
          }`}>
            <div className="flex items-start gap-2.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 border ${
                isLight
                  ? 'bg-emerald-100/80 border-emerald-300 text-emerald-800'
                  : 'bg-brand-950/80 border-brand-700/60 text-brand-300'
              }`}>
                REF #{i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`font-semibold text-xs leading-snug hover:underline block ${
                        isLight ? 'text-emerald-700 hover:text-emerald-800' : 'text-brand-300 hover:text-brand-200'
                      }`}
                    >
                      {src.title} ↗
                    </a>
                  ) : (
                    <span className={`font-semibold text-xs leading-snug ${
                      isLight ? 'text-slate-800' : 'text-gray-200'
                    }`}>{src.title}</span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 border ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-500'
                      : 'bg-surface-card border-surface-border text-gray-400'
                  }`}>
                    Peer-Reviewed
                  </span>
                </div>
                {src.excerpt && (
                  <p className={`mt-1.5 text-[12.5px] leading-relaxed italic ${
                    isLight ? 'text-slate-600' : 'text-gray-300'
                  } ${isExpanded ? '' : 'line-clamp-3'}`}>
                    "{src.excerpt}"
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
