import React, { useState, useRef, type KeyboardEvent } from 'react';
import { PaperclipIcon, ImageIcon, SendPlaneIcon } from './Icons';

interface ChatInputProps {
  onSend: (text: string, image?: File) => void;
  isLoading: boolean;
  theme?: 'dark' | 'light';
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB = 10;

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading,
  theme = 'dark',
  inputRef: externalInputRef,
}) => {
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const activeInputRef = externalInputRef || internalInputRef;

  const isLight = theme === 'light';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Unsupported file type. Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`Image too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = () => {
    if (isLoading) return;
    if (!text.trim() && !imageFile) return;
    onSend(text.trim(), imageFile || undefined);
    setText('');
    removeImage();
    activeInputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full px-3 sm:px-8 pb-3 sm:pb-5 pt-1.5 sm:pt-2 flex-shrink-0 bg-transparent">
      <div className="max-w-4xl lg:max-w-5xl w-full mx-auto">
        {/* Image preview badge if file is selected */}
        {imagePreview && (
          <div className={`mb-2 relative inline-flex items-center gap-2.5 rounded-2xl p-1.5 pr-3.5 shadow-lg ${
            isLight
              ? 'bg-white border border-slate-300 text-slate-800'
              : 'bg-[#101625] border border-[#1e2638] text-gray-200'
          }`}>
            <img
              src={imagePreview}
              alt="Attachment preview"
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border ${
                isLight ? 'border-slate-300' : 'border-[#2a3449]'
              }`}
            />
            <span className={`text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[200px] ${isLight ? 'text-slate-800' : 'text-gray-200'}`}>
              {imageFile?.name || 'Attached photo'}
            </span>
            <button
              onClick={removeImage}
              className="w-5 h-5 bg-gray-600 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center transition-colors cursor-pointer"
              title="Remove photo"
            >
              ×
            </button>
          </div>
        )}

        {/* File error */}
        {fileError && (
          <p className="text-rose-500 text-xs sm:text-sm mb-2 px-3 font-medium">{fileError}</p>
        )}

        {/* Floating Pill Input Bar */}
        <div className={`rounded-full px-3 sm:px-6 py-1.5 sm:py-2.5 flex items-center gap-2 sm:gap-4 transition-all duration-150 ${
          isLight
            ? 'bg-white border border-slate-300 shadow-xl shadow-slate-200/80 focus-within:border-emerald-500/70 focus-within:ring-2 focus-within:ring-emerald-500/20'
            : 'bg-[#101625] border border-[#1e2638] shadow-2xl shadow-black/70 focus-within:border-emerald-500/60'
        }`}>
          {/* Paperclip attachment icon */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className={`p-1.5 transition-colors cursor-pointer disabled:opacity-40 shrink-0 ${
              isLight
                ? 'text-slate-400 hover:text-slate-700'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Attach file"
          >
            <PaperclipIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* Central text input */}
          <input
            ref={activeInputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={imageFile ? 'Describe what you see…' : 'Ask about your pet...'}
            className={`flex-1 min-w-0 bg-transparent text-[15px] sm:text-base focus:outline-none py-1 sm:py-2 ${
              isLight
                ? 'text-slate-900 placeholder:text-slate-400'
                : 'text-gray-100 placeholder:text-gray-500'
            }`}
            aria-label="Ask about your pet"
          />

          {/* Image gallery icon */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className={`p-1.5 transition-colors cursor-pointer disabled:opacity-40 shrink-0 ${
              isLight
                ? 'text-slate-400 hover:text-slate-700'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Upload photo"
          >
            <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Circular green send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || (!text.trim() && !imageFile)}
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#10b981] hover:bg-[#0d9668] active:bg-[#059669] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white shadow-lg shadow-emerald-950/50 transition-all cursor-pointer flex-shrink-0"
            aria-label="Send message"
          >
            {isLoading ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <SendPlaneIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white -rotate-45 translate-x-[-1px] translate-y-[-1px]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
