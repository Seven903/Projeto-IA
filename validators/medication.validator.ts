// src/validators/medication.validator.ts
// ============================================================
// Schemas de validação para endpoints de medicamentos e lotes.
//
// Schemas exportados:
//   createMedicationSchema  → POST /medications
//   updateMedicationSchema  → PUT  /medications/:id
//   receiveBatchSchema      → POST /medications/:id/batches
//   medicationSearchSchema  → GET  /medications?q=...
// ============================================================

import { z } from 'zod';

// ── Helpers ──────────────────────────────────────────────────

const uuidSchema = z
  .string({ required_error: 'ID é obrigatório.' })
  .uuid({ message: 'ID deve ser um UUID válido.' });

const positiveInt = (fieldName: string) =>
  z
    .number({ required_error: `${fieldName} é obrigatório.` })
    .int(`${fieldName} deve ser um número inteiro.`)
    .positive(`${fieldName} deve ser maior que zero.`);

// ── CREATE MEDICATION ────────────────────────────────────────

export const createMedicationSchema = z.object({
  body: z.object({
    sku: z
      .string({ required_error: 'SKU é obrigatório.' })
      .min(2, 'SKU deve ter pelo menos 2 caracteres.')
      .max(50, 'SKU não pode exceder 50 caracteres.')
      .trim(),

    commercialName: z
      .string({ required_error: 'Nome comercial é obrigatório.' })
      .min(2, 'Nome comercial deve ter pelo menos 2 caracteres.')
      .max(150)
      .trim(),

    activeIngredient: z
      .string({ required_error: 'Princípio ativo é obrigatório.' })
      .min(2, 'Princípio ativo deve ter pelo menos 2 caracteres.')
      .max(150)
      .trim(),
    // Nota: a normalização (lowercase, sem acentos) é feita
    // no controller/service com normalizeIngredient()

    dosage: z
      .string({ required_error: 'Dosagem é obrigatória.' })
      .min(1)
      .max(50, 'Dosagem não pode exceder 50 caracteres.')
      .trim(),

    pharmaceuticalForm: z
      .string({ required_error: 'Forma farmacêutica é obrigatória.' })
      .min(2)
      .max(50)
      .trim(),

    unitMeasure: z
      .string({ required_error: 'Unidade de medida é obrigatória.' })
      .min(1)
      .max(20)
      .trim(),

    minimumStockQty: z
      .number()
      .int('Estoque mínimo deve ser um número inteiro.')
      .min(0, 'Estoque mínimo não pode ser negativo.')
      .default(10)
      .optional(),

    isControlled: z.boolean().default(false).optional(),

    requiresPrescription: z.boolean().default(false).optional(),
  }),
});

// ── UPDATE MEDICATION ────────────────────────────────────────

export const updateMedicationSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      commercialName: z.string().min(2).max(150).trim().optional(),
      dosage: z.string().min(1).max(50).trim().optional(),
      pharmaceuticalForm: z.string().min(2).max(50).trim().optional(),
      unitMeasure: z.string().min(1).max(20).trim().optional(),
      minimumStockQty: z
        .number()
        .int()
        .min(0, 'Estoque mínimo não pode ser negativo.')
        .optional(),
      isControlled: z.boolean().optional(),
      requiresPrescription: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      { message: 'Ao menos um campo deve ser informado para atualização.' }
    ),
});

// ── RECEIVE BATCH ────────────────────────────────────────────

export const receiveBatchSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      batchNumber: z
        .string({ required_error: 'Número do lote é obrigatório.' })
        .min(2, 'Número do lote deve ter pelo menos 2 caracteres.')
        .max(50)
        .trim(),

      manufacturer: z
        .string()
        .max(150)
        .trim()
        .optional()
        .nullable(),

      quantityTotal: positiveInt('Quantidade total'),

      manufactureDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
          message: 'Data de fabricação inválida.',
        })
        .refine(
          (val) => new Date(val) <= new Date(),
          { message: 'Data de fabricação não pode ser no futuro.' }
        )
        .optional()
        .nullable(),

      expiryDate: z
        .string({ required_error: 'Data de validade é obrigatória.' })
        .refine((val) => !isNaN(Date.parse(val)), {
          message: 'Data de validade inválida. Use o formato YYYY-MM-DD.',
        })
        .refine(
          (val) => new Date(val) > new Date(),
          {
            message:
              'Não é permitido registrar lote com data de validade já vencida.',
          }
        ),

      alertDaysBeforeExpiry: z
        .number()
        .int()
        .min(1, 'Dias de alerta deve ser pelo menos 1.')
        .max(365)
        .default(30)
        .optional(),

      notes: z
        .string()
        .max(500)
        .trim()
        .optional()
        .nullable(),
    })
    .refine(
      (data) => {
        if (!data.manufactureDate) return true;
        return new Date(data.manufactureDate) < new Date(data.expiryDate);
      },
      {
        message: 'Data de fabricação deve ser anterior à data de validade.',
        path: ['manufactureDate'],
      }
    ),
});

// ── MEDICATION SEARCH QUERY ──────────────────────────────────

export const medicationSearchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(100).trim().optional(),
    isControlled: z.enum(['true', 'false']).optional(),
    isActive: z.enum(['true', 'false', 'all']).default('true').optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
});

// ── Tipos inferidos ──────────────────────────────────────────
export type CreateMedicationInput = z.infer<typeof createMedicationSchema>['body'];
export type ReceiveBatchInput = z.infer<typeof receiveBatchSchema>['body'];