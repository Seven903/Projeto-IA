// src/validators/dispensation.validator.ts
// ============================================================
// Schemas de validação para endpoints de dispensação.
//
// Schemas exportados:
//   dispenseSchema          → POST /dispensations
//   allergyCheckSchema      → POST /dispensations/check
//   reportDateRangeSchema   → GET  /reports/* (query params de período)
// ============================================================

import { z } from 'zod';

// ── Helpers ──────────────────────────────────────────────────

const uuidSchema = z
  .string({ required_error: 'ID é obrigatório.' })
  .uuid({ message: 'ID deve ser um UUID válido.' });

const dateQuerySchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Data deve estar no formato YYYY-MM-DD.'
  )
  .optional();

// ── DISPENSE ─────────────────────────────────────────────────

export const dispenseSchema = z.object({
  body: z.object({
    attendanceId: uuidSchema.describe(
      'UUID do atendimento ao qual a dispensação pertence. O atendimento deve estar com status "open".'
    ),

    batchId: uuidSchema.describe(
      'UUID do lote específico a ser dispensado. Deve ter estoque disponível e não estar vencido.'
    ),

    quantityDispensed: z
      .number({ required_error: 'Quantidade dispensada é obrigatória.' })
      .int('Quantidade dispensada deve ser um número inteiro.')
      .min(1, 'Quantidade dispensada deve ser pelo menos 1.')
      .max(100, 'Quantidade dispensada não pode exceder 100 unidades por dispensação.'),

    dosageInstructions: z
      .string({ required_error: 'Instruções de posologia são obrigatórias.' })
      .min(5, 'Instruções de posologia muito curtas. Descreva claramente a dosagem e frequência.')
      .max(1000, 'Instruções de posologia não podem exceder 1000 caracteres.')
      .trim(),

    notes: z
      .string()
      .max(500, 'Observações não podem exceder 500 caracteres.')
      .trim()
      .optional()
      .nullable(),
  }),
});

// ── ALLERGY CHECK (pré-verificação sem dispensar) ────────────

export const allergyCheckSchema = z.object({
  body: z.object({
    studentId: uuidSchema.describe('UUID do estudante a verificar.'),

    batchId: uuidSchema.describe(
      'UUID do lote cujo princípio ativo será verificado contra as alergias do estudante.'
    ),
  }),
});

// ── REPORT DATE RANGE QUERY ──────────────────────────────────
// Reutilizado em todos os endpoints de relatório.

export const reportDateRangeSchema = z.object({
  query: z
    .object({
      startDate: dateQuerySchema,
      endDate: dateQuerySchema,
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
      },
      {
        message: 'startDate não pode ser posterior a endDate.',
        path: ['startDate'],
      }
    )
    .refine(
      (data) => {
        // Impede ranges maiores que 2 anos para proteger performance
        if (data.startDate && data.endDate) {
          const diffMs =
            new Date(data.endDate).getTime() -
            new Date(data.startDate).getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          return diffDays <= 730;
        }
        return true;
      },
      {
        message: 'O período não pode exceder 2 anos.',
        path: ['endDate'],
      }
    ),
});

// ── LOGIN ────────────────────────────────────────────────────

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'E-mail é obrigatório.' })
      .email('Formato de e-mail inválido.')
      .max(255)
      .trim()
      .toLowerCase(),

    password: z
      .string({ required_error: 'Senha é obrigatória.' })
      .min(6, 'Senha deve ter pelo menos 6 caracteres.')
      .max(128, 'Senha não pode exceder 128 caracteres.'),
  }),
});

// ── UUID PARAM ───────────────────────────────────────────────
// Schema genérico para validar :id nas rotas.

export const idParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// ── Tipos inferidos ──────────────────────────────────────────
export type DispenseInput = z.infer<typeof dispenseSchema>['body'];
export type AllergyCheckInput = z.infer<typeof allergyCheckSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];