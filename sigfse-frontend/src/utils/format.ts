// src/utils/format.ts
// Formatadores de exibição usados nas páginas e componentes.
// As funções de data espelham formatDateBR e formatDateTimeBR do backend (dateHelpers.ts).
// Os labels de status espelham os getters statusLabel do backend.

import type { AttendanceStatus, AllergySeverity, AlertLevel, Gender, UserRole } from '../types';

// ─────────────────────────────────────────────────────────────
// DATAS
// Espelham dateHelpers.ts do backend
// ─────────────────────────────────────────────────────────────

// Formata para DD/MM/YYYY — ex: "15/03/2024"
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// Formata para DD/MM/YYYY às HH:MM — ex: "15/03/2024 às 14:32"
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  const dateStr = d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });
  return `${dateStr} às ${timeStr}`;
}

// Formata apenas HH:MM — ex: "14:32"
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Calcula a idade em anos completos — espelha calculateAge do backend
export function calcAge(birthDate: string | Date): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Retorna data no formato YYYY-MM-DD para inputs do tipo date
export function toInputDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────
// STATUS E LABELS
// Espelham os getters do backend (statusLabel, severityLabel, etc.)
// ─────────────────────────────────────────────────────────────

// Espelha Attendance.statusLabel (getter do model)
export const attendanceStatusLabel: Record<AttendanceStatus, string> = {
  open:            'Em atendimento',
  dispensed:       'Medicado',
  referred:        'Encaminhado',
  closed:          'Encerrado',
  blocked_allergy: 'Bloqueado — Alergia',
};

// Espelha StudentAllergy.severityLabel (getter do model)
export const allergySeverityLabel: Record<AllergySeverity, string> = {
  mild:         'Leve',
  moderate:     'Moderada',
  severe:       'Severa',
  anaphylactic: 'Anafilática',
};

// Espelha StockAlertDto.alertLevel
export const alertLevelLabel: Record<AlertLevel, string> = {
  critical: 'Crítico',
  warning:  'Atenção',
  info:     'Informativo',
};

// Labels de gênero — espelha Gender do backend
export const genderLabel: Record<Gender, string> = {
  male:         'Masculino',
  female:       'Feminino',
  non_binary:   'Não-binário',
  not_informed: 'Não informado',
};

// Labels de role — espelha UserRole do backend
export const roleLabel: Record<UserRole, string> = {
  nurse:      'Enfermeiro(a)',
  pharmacist: 'Farmacêutico(a)',
  admin:      'Administrador(a)',
  superadmin: 'Super Admin',
};