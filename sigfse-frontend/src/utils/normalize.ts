// src/utils/normalize.ts
// Normalização de strings do frontend — espelha exatamente normalize.ts do backend.
// CRÍTICO: normalizeIngredient DEVE produzir o mesmo resultado que o backend
// para que o cross-check de alergia (POST /dispensations/check) funcione corretamente.
// O backend persiste activeIngredient normalizado; o frontend deve enviar o mesmo formato.

// ─────────────────────────────────────────────────────────────
// PRINCÍPIO ATIVO — espelha normalizeIngredient() do backend
// ─────────────────────────────────────────────────────────────

// Normaliza um princípio ativo para persistência e comparação.
// Mesmas transformações do backend (em ordem):
//   1. trim
//   2. toLowerCase
//   3. NFD + remoção de diacríticos (á→a, ç→c, etc.)
//   4. remove caracteres especiais (mantém letras, números, espaços)
//   5. colapsa múltiplos espaços
//
// Exemplos:
//   "Dipirona Sódica"  → "dipirona sodica"
//   "IBUPROFENO"       → "ibuprofeno"
//   "Amoxicilína"      → "amoxicilina"
export function normalizeIngredient(ingredient: string): string {
  if (!ingredient || typeof ingredient !== 'string') return '';
  return ingredient
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────
// OUTROS — espelham normalize.ts do backend
// ─────────────────────────────────────────────────────────────

// Normaliza nome para busca textual — espelha normalizeName()
export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normaliza matrícula para busca — espelha normalizeEnrollmentCode()
export function normalizeEnrollmentCode(code: string): string {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

// Normaliza e-mail — espelha normalizeEmail()
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// FORMATAÇÃO DE ENTRADA
// Utilitários para máscaras em inputs do formulário
// ─────────────────────────────────────────────────────────────

// Formata telefone enquanto o usuário digita — ex: "(11) 99999-9999"
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

// Formata pressão arterial — ex: "120/80"
export function maskBloodPressure(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, digits.length - 2)}/${digits.slice(-2)}`;
}

// Trunca texto longo com reticências
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text ?? '';
  return text.slice(0, maxLength).trimEnd() + '...';
}