// src/components/ui/Textarea.tsx
import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, rows = 3, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '_');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`
            w-full border rounded-lg px-3 py-2 text-sm text-gray-900
            placeholder:text-gray-400 bg-white resize-none
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
            disabled:bg-gray-50 disabled:text-gray-400 transition-colors
            ${error ? 'border-red-400 focus:ring-red-400' : 'border-gray-200'}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';