// src/components/ui/Input.tsx
import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '_');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full border rounded-lg px-3 py-2 text-sm text-gray-900
              placeholder:text-gray-400 bg-white
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
              disabled:bg-gray-50 disabled:text-gray-400 transition-colors
              ${error ? 'border-red-400 focus:ring-red-400' : 'border-gray-200'}
              ${leftIcon ? 'pl-9' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';