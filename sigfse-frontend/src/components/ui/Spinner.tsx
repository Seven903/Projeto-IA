// src/components/ui/Spinner.tsx
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`
        rounded-full border-gray-200 border-t-brand-600 animate-spin
        ${sizes[size]} ${className}
      `}
    />
  );
}

// Tela inteira de loading — usada enquanto o AuthContext restaura a sessão
export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <Spinner size="lg" />
    </div>
  );
}