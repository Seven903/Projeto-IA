// src/validators/attendance.validator.ts
// ============================================================
// Schemas de validação para endpoints de atendimentos.
//
// Schemas exportados:
//   openAttendanceSchema    → POST /attendances
//   closeAttendanceSchema   → PUT  /attendances/:id/close
//   attendanceSearchSchema  → GET  /attendances?...
// ============================================================

import { z } from 'zod';

// ── Helpers ──────────────────────────────────────────────────

const uuidSchema = z
  .string({ required_error: 'ID é obrigatório.' })
  .uuid({ message: 'ID deve ser um UUID válido.' });

// ── OPEN ATTENDANCE ──────────────────────────────────────────

export const openAttendanceSchema = z.object({
  body: z.object({
    studentId: uuidSchema.describe('UUID do estudante a ser atendido.'),

    symptoms: z
      .string({ required_error: 'Descrição dos sintomas é obrigatória.' })
      .min(5, 'Descreva os sintomas com pelo menos 5 caracteres.')
      .max(2000, 'Descrição dos sintomas não pode exceder 2000 caracteres.')
      .trim(),

    clinicalNotes: z
      .string()
      .max(2000, 'Notas clínicas não podem exceder 2000 caracteres.')
      .trim()
      .optional()
      .nullable(),

    temperatureC: z
      .number()
      .min(30, 'Temperatura abaixo de 30°C é considerada inválida.')
      .max(45, 'Temperatura acima de 45°C é considerada inválida.')
      .optional()
      .nullable()
      .refine(
        (val) => val === null || val === undefined || Number(val.toFixed(1)) === val,
        { message: 'Temperatura deve ter no máximo 1 casa decimal. Ex: 37.5' }
      ),

    bloodPressure: z
      .string()
      .regex(
        /^\d{2,3}\/\d{2,3}$/,
        'Pressão arterial deve estar no formato "120/80".'
      )
      .optional()
      .nullable(),
  }),
});

// ── CLOSE ATTENDANCE ─────────────────────────────────────────

export const closeAttendanceSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      status: z.enum(['referred', 'closed'], {
        required_error: 'Status de encerramento é obrigatório.',
        errorMap: () => ({
          message: 'Status inválido. Use "referred" (encaminhado) ou "closed" (encerrado).',
        }),
      }),

      clinicalNotes: z
        .string()
        .max(2000)
        .trim()
        .optional()
        .nullable(),

      referralDestination: z
        .string()
        .max(500, 'Destino do encaminhamento não pode exceder 500 caracteres.')
        .trim()
        .optional()
        .nullable(),
    })
    .refine(
      (data) => {
        // Se encaminhado, destino é obrigatório
        if (data.status === 'referred') {
          return !!data.referralDestination?.trim();
        }
        return true;
      },
      {
        message:
          'referralDestination é obrigatório quando o status é "referred".',
        path: ['referralDestination'],
      }
    ),
});

// ── ATTENDANCE SEARCH QUERY ──────────────────────────────────

export const attendanceSearchSchema = z.object({
  query: z.object({
    studentId: z.string().uuid('studentId deve ser um UUID válido.').optional(),

    attendedBy: z.string().uuid('attendedBy deve ser um UUID válido.').optional(),

    status: z
      .enum(['open', 'dispensed', 'referred', 'closed', 'blocked_allergy'])
      .optional(),

    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate deve estar no formato YYYY-MM-DD.')
      .optional(),

    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate deve estar no formato YYYY-MM-DD.')
      .optional(),

    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }).refine(
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
  ),
});

// ── Tipos inferidos ──────────────────────────────────────────
export type OpenAttendanceInput = z.infer<typeof openAttendanceSchema>['body'];
export type CloseAttendanceInput = z.infer<typeof closeAttendanceSchema>['body'];