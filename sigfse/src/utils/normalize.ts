// src/utils/normalize.ts
// ============================================================
// Utilitários de normalização de strings.
//
// Por que este arquivo existe?
//   O cross-check de alergia compara o activeIngredient de um
//   medicamento com os activeIngredient cadastrados nas alergias
//   do aluno. Para que essa comparação seja confiável, ambos os
//   valores precisam passar pela MESMA função de normalização
//   antes de serem persistidos e antes de serem comparados.
//
//   Sem normalização, "Dipirona Sódica" ≠ "dipirona sodica" ≠
//   "DIPIRONA SODICA" — três representações do mesmo princípio
//   ativo que gerariam falsos negativos no cross-check, podendo
//   resultar em dispensação de medicamento para aluno alérgico.
//
// Uso:
//   Sempre que um activeIngredient for inserido no banco
//   (Medication ou StudentAllergy), passe pelo normalizeIngredient()
//   antes de persistir. O validator do model também reforça isso.
// ============================================================

/**
 * Normaliza um princípio ativo farmacológico para comparação segura.
 *
 * Transformações aplicadas (nesta ordem):
 *   1. Trim — remove espaços no início e fim
 *   2. toLowerCase — converte para minúsculas
 *   3. NFD + remoção de diacríticos — remove acentos (á→a, ç→c, etc.)
 *   4. Remoção de caracteres especiais — mantém apenas letras, números e espaços
 *   5. Colapso de espaços múltiplos — "dipirona  sodica" → "dipirona sodica"
 *
 * Exemplos:
 *   "Dipirona Sódica"     → "dipirona sodica"
 *   "IBUPROFENO"          → "ibuprofeno"
 *   "Amoxicilína"         → "amoxicilina"
 *   "  Ácido Acetilsal. " → "acido acetilsal"
 *   "Cetirizina 10mg"     → "cetirizina 10mg"
 *
 * @param ingredient - Princípio ativo em qualquer formato
 * @returns String normalizada pronta para comparação e persistência
 */
export function normalizeIngredient(ingredient: string): string {
  if (!ingredient || typeof ingredient !== 'string') return '';

  return ingredient
    .trim()
    .toLowerCase()
    .normalize('NFD')                      // decompõe caracteres compostos (á → a + ́)
    .replace(/[\u0300-\u036f]/g, '')       // remove os diacríticos decompostos
    .replace(/[^a-z0-9\s]/g, '')           // remove caracteres especiais restantes
    .replace(/\s+/g, ' ')                  // colapsa múltiplos espaços em um
    .trim();                               // trim final após colapso
}

/**
 * Verifica se dois princípios ativos representam a mesma substância.
 * Ambos passam pela normalização antes da comparação.
 *
 * Exemplos:
 *   isSameIngredient("Dipirona Sódica", "dipirona sodica") → true
 *   isSameIngredient("Ibuprofeno", "Paracetamol")          → false
 *
 * @param a - Primeiro princípio ativo
 * @param b - Segundo princípio ativo
 * @returns true se representam a mesma substância após normalização
 */
export function isSameIngredient(a: string, b: string): boolean {
  return normalizeIngredient(a) === normalizeIngredient(b);
}

/**
 * Verifica se um ingrediente está contido em uma lista de ingredientes normalizados.
 * Usado pelo AllergyCheckService para o cross-check.
 *
 * @param ingredient - Princípio ativo a verificar
 * @param list - Lista de princípios ativos (já normalizados ou não)
 * @returns true se o ingrediente estiver na lista
 */
export function ingredientInList(ingredient: string, list: string[]): boolean {
  const normalized = normalizeIngredient(ingredient);
  return list.some((item) => normalizeIngredient(item) === normalized);
}

/**
 * Normaliza o nome completo de um usuário ou aluno para busca textual.
 * Remove acentos e converte para minúsculas para comparação case-insensitive.
 *
 * Exemplos:
 *   "João da Silva"  → "joao da silva"
 *   "BEATRIZ LIMA"   → "beatriz lima"
 *
 * @param name - Nome em qualquer formato
 * @returns Nome normalizado para busca
 */
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

/**
 * Normaliza um código de matrícula para busca.
 * Remove espaços e converte para maiúsculas.
 *
 * Exemplos:
 *   " 2024001 " → "2024001"
 *   "mat-001"   → "MAT-001"
 *
 * @param code - Código de matrícula em qualquer formato
 * @returns Matrícula normalizada
 */
export function normalizeEnrollmentCode(code: string): string {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

/**
 * Normaliza um e-mail para comparação e persistência.
 * Converte para minúsculas e remove espaços.
 *
 * @param email - E-mail em qualquer formato
 * @returns E-mail normalizado
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}