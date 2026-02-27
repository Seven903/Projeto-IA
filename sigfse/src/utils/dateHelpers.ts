// src/utils/dateHelpers.ts
// ============================================================
// Utilitários de manipulação de datas.
//
// Centraliza toda a lógica de cálculo de datas do sistema para
// evitar duplicação e garantir consistência entre:
//   • Alertas de vencimento de lotes (StockService)
//   • Filtros de relatórios por período (ReportService)
//   • Exibição de datas na API e no frontend
//   • Cálculo de faixas de tempo para heatmap de atendimentos
// ============================================================

// ── Tipos auxiliares ─────────────────────────────────────────

export interface DateRange {
  start: Date;
  end: Date;
}

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear';

// ── Funções de verificação de validade ───────────────────────

/**
 * Verifica se uma data de validade já passou.
 *
 * @param expiryDate - Data de validade do lote
 * @returns true se o lote já está vencido
 */
export function isExpired(expiryDate: Date | string): boolean {
  return new Date() > new Date(expiryDate);
}

/**
 * Verifica se um lote vence dentro de N dias.
 *
 * @param expiryDate - Data de validade do lote
 * @param days - Janela de alerta em dias (padrão: 30)
 * @returns true se o lote vence dentro do período informado
 */
export function isExpiringSoon(
  expiryDate: Date | string,
  days: number = 30
): boolean {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const alertThreshold = new Date(expiry);
  alertThreshold.setDate(alertThreshold.getDate() - days);
  return now >= alertThreshold && now <= expiry;
}

/**
 * Calcula o número de dias entre hoje e a data de validade.
 * Retorna valor negativo se já vencido.
 *
 * @param expiryDate - Data de validade
 * @returns Número de dias até o vencimento (negativo se vencido)
 */
export function daysUntilExpiry(expiryDate: Date | string): number {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Retorna uma label amigável do status de validade de um lote.
 *
 * Exemplos:
 *   isExpired=true           → "Vencido há 5 dias"
 *   daysUntilExpiry=0        → "Vence hoje"
 *   daysUntilExpiry=1        → "Vence amanhã"
 *   daysUntilExpiry=15       → "Vence em 15 dias"
 *   daysUntilExpiry=120      → "Válido (120 dias)"
 *
 * @param expiryDate - Data de validade
 */
export function expiryStatusLabel(expiryDate: Date | string): string {
  const days = daysUntilExpiry(expiryDate);

  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''}`;
  if (days === 0) return 'Vence hoje ⚠️';
  if (days === 1) return 'Vence amanhã ⚠️';
  if (days <= 30) return `Vence em ${days} dias ⚠️`;
  return `Válido (${days} dias)`;
}

// ── Faixas de tempo para relatórios ──────────────────────────

/**
 * Retorna o início e fim de um período pré-definido.
 * Útil para filtros de relatório e heatmap de atendimentos.
 *
 * @param preset - Período pré-definido
 * @returns Objeto com start e end no horário local
 */
export function getDateRange(preset: PeriodPreset): DateRange {
  const now = new Date();

  // Início do dia atual (00:00:00.000)
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Fim do dia atual (23:59:59.999)
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today':
      return { start: startOfToday, end: endOfToday };

    case 'yesterday': {
      const startYesterday = new Date(startOfToday);
      startYesterday.setDate(startYesterday.getDate() - 1);
      const endYesterday = new Date(endOfToday);
      endYesterday.setDate(endYesterday.getDate() - 1);
      return { start: startYesterday, end: endYesterday };
    }

    case 'last7days': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 6);
      return { start, end: endOfToday };
    }

    case 'last30days': {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 29);
      return { start, end: endOfToday };
    }

    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }

    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }

    case 'thisYear': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end };
    }

    default:
      return { start: startOfToday, end: endOfToday };
  }
}

/**
 * Retorna um DateRange a partir de strings ISO opcionais.
 * Se não fornecidos, usa o mês atual como padrão.
 * Usado para validar e normalizar parâmetros de query da API.
 *
 * @param startStr - Data de início no formato YYYY-MM-DD (opcional)
 * @param endStr   - Data de fim no formato YYYY-MM-DD (opcional)
 * @returns DateRange validado e com horários corretos
 */
export function parseDateRangeFromQuery(
  startStr?: string,
  endStr?: string
): DateRange {
  if (!startStr && !endStr) {
    return getDateRange('thisMonth');
  }

  const start = startStr
    ? new Date(`${startStr}T00:00:00.000`)
    : getDateRange('thisMonth').start;

  const end = endStr
    ? new Date(`${endStr}T23:59:59.999`)
    : getDateRange('thisMonth').end;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Formato de data inválido. Use YYYY-MM-DD.');
  }

  if (start > end) {
    throw new Error('A data de início não pode ser posterior à data de fim.');
  }

  return { start, end };
}

// ── Formatação de datas para API e exibição ──────────────────

/**
 * Formata uma data para o padrão brasileiro DD/MM/YYYY.
 *
 * @param date - Data a formatar
 * @returns String no formato DD/MM/YYYY
 */
export function formatDateBR(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata uma data e hora para o padrão brasileiro.
 * Ex: "15/03/2024 às 14:32"
 *
 * @param date - Data a formatar
 * @returns String no formato DD/MM/YYYY às HH:MM
 */
export function formatDateTimeBR(date: Date | string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  const dateStr = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} às ${timeStr}`;
}

/**
 * Retorna a data atual como string no formato YYYY-MM-DD.
 * Útil para comparações com campos DATEONLY do SQLite.
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Retorna o timestamp atual no formato ISO 8601 completo.
 * Padrão para campos DATETIME do SQLite.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Calcula a idade em anos completos a partir da data de nascimento.
 *
 * @param birthDate - Data de nascimento
 * @returns Idade em anos completos
 */
export function calculateAge(birthDate: Date | string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Gera os rótulos de horas do dia para o eixo X do heatmap de atendimentos.
 * Retorna array de 24 strings no formato "00h", "01h", ..., "23h".
 */
export function generateHourLabels(): string[] {
  return Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0') + 'h'
  );
}

/**
 * Gera os rótulos dos dias da semana para o eixo Y do heatmap.
 */
export function generateWeekdayLabels(): string[] {
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
}