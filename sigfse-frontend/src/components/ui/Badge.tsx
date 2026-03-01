// src/components/ui/Badge.tsx
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  className?: string;
}

const variants = {
  default: 'bg-gray-100 text-gray-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger:  'bg-red-100 text-red-700',
  info:    'bg-blue-100 text-blue-700',
  purple:  'bg-purple-100 text-purple-700',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
        ${variants[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}

// Badge de status de atendimento — usa AttendanceStatus do backend
import type { AttendanceStatus } from '../../types';

const attendanceVariants: Record<AttendanceStatus, { variant: BadgeProps['variant']; label: string }> = {
  open:            { variant: 'info',    label: 'Em atendimento' },
  dispensed:       { variant: 'success', label: 'Medicado' },
  referred:        { variant: 'warning', label: 'Encaminhado' },
  closed:          { variant: 'default', label: 'Encerrado' },
  blocked_allergy: { variant: 'danger',  label: 'Bloqueado — Alergia' },
};

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const { variant, label } = attendanceVariants[status];
  return <Badge variant={variant}>{label}</Badge>;
}

// Badge de severidade de alergia — usa AllergySeverity do backend
import type { AllergySeverity } from '../../types';

const severityVariants: Record<AllergySeverity, { variant: BadgeProps['variant']; label: string }> = {
  mild:         { variant: 'info',    label: 'Leve' },
  moderate:     { variant: 'warning', label: 'Moderada' },
  severe:       { variant: 'danger',  label: 'Severa' },
  anaphylactic: { variant: 'danger',  label: 'Anafilática ⚠️' },
};

export function SeverityBadge({ severity }: { severity: AllergySeverity }) {
  const { variant, label } = severityVariants[severity];
  return <Badge variant={variant}>{label}</Badge>;
}

// Badge de nível de alerta de estoque — usa AlertLevel do backend
import type { AlertLevel } from '../../types';

const alertVariants: Record<AlertLevel, { variant: BadgeProps['variant']; label: string }> = {
  critical: { variant: 'danger',  label: 'Crítico' },
  warning:  { variant: 'warning', label: 'Atenção' },
  info:     { variant: 'info',    label: 'Info' },
};

export function AlertLevelBadge({ level }: { level: AlertLevel }) {
  const { variant, label } = alertVariants[level];
  return <Badge variant={variant}>{label}</Badge>;
}