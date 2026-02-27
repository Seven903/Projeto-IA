// src/validators/student.validator.ts
// ============================================================
// Schemas de validação para endpoints de estudantes.
//
// Biblioteca: Zod — validação com inferência de tipos TypeScript.
//
// Schemas exportados:
//   createStudentSchema     → POST /students
//   updateStudentSchema     → PUT  /students/:id
//   addAllergySchema        → POST /students/:id/allergies
//   studentSearchSchema     → GET  /students?q=...
//
// Uso nas rotas:
//   import { validate } from '../middlewares/validate.middleware';
//   import { createStudentSchema } from '../validators/student.validator';
//   router.post('/', validate(createStudentSchema), controller.create);
// ============================================================

import { z } from 'zod';

// ── Helpers reutilizáveis ────────────────────────────────────

const uuidSchema = z
  .string({ required_error: 'ID é obrigatório.' })
  .uuid({ message: 'ID deve ser um UUID válido.' });

const dateSchema = z
  .string({ required_error: 'Data é obrigatória.' })
  .refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data inválida. Use o formato YYYY-MM-DD.',
  });

// ── CREATE STUDENT ───────────────────────────────────────────

export const createStudentSchema = z.object({
  body: z.object({
    enrollmentCode: z
      .string({ required_error: 'Matrícula é obrigatória.' })
      .min(2, 'Matrícula deve ter pelo menos 2 caracteres.')
      .max(30, 'Matrícula não pode exceder 30 caracteres.')
      .trim(),

    fullName: z
      .string({ required_error: 'Nome completo é obrigatório.' })
      .min(3, 'Nome deve ter pelo menos 3 caracteres.')
      .max(150, 'Nome não pode exceder 150 caracteres.')
      .trim(),

    birthDate: dateSchema.refine(
      (val) => new Date(val) < new Date(),
      { message: 'Data de nascimento não pode ser no futuro.' }
    ),

    gender: z
      .enum(['male', 'female', 'non_binary', 'not_informed'], {
        errorMap: () => ({
          message: 'Gênero inválido. Use: male, female, non_binary ou not_informed.',
        }),
      })
      .default('not_informed'),

    gradeClass: z
      .string()
      .max(20, 'Turma não pode exceder 20 caracteres.')
      .trim()
      .optional(),

    guardianName: z
      .string({ required_error: 'Nome do responsável é obrigatório.' })
      .min(3, 'Nome do responsável deve ter pelo menos 3 caracteres.')
      .max(150, 'Nome do responsável não pode exceder 150 caracteres.')
      .trim(),

    guardianPhone: z
      .string({ required_error: 'Telefone do responsável é obrigatório.' })
      .min(8, 'Telefone deve ter pelo menos 8 caracteres.')
      .max(20, 'Telefone não pode exceder 20 caracteres.')
      .trim(),

    guardianEmail: z
      .string()
      .email('E-mail do responsável inválido.')
      .max(255)
      .trim()
      .optional()
      .nullable(),

    guardianRelation: z
      .string()
      .max(50, 'Relação não pode exceder 50 caracteres.')
      .trim()
      .optional()
      .nullable(),

    lgpdConsent: z.literal(true, {
      errorMap: () => ({
        message:
          'O consentimento LGPD do responsável legal é obrigatório (deve ser true).',
      }),
    }),

    bloodType: z
      .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], {
        errorMap: () => ({
          message: 'Tipo sanguíneo inválido. Valores aceitos: A+, A-, B+, B-, AB+, AB-, O+, O-.',
        }),
      })
      .optional()
      .nullable(),
  }),
});

// ── UPDATE STUDENT ───────────────────────────────────────────
// Todos os campos são opcionais — apenas os informados são atualizados.

export const updateStudentSchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z
    .object({
      fullName: z
        .string()
        .min(3, 'Nome deve ter pelo menos 3 caracteres.')
        .max(150)
        .trim()
        .optional(),

      gender: z
        .enum(['male', 'female', 'non_binary', 'not_informed'])
        .optional(),

      gradeClass: z
        .string()
        .max(20)
        .trim()
        .optional()
        .nullable(),

      guardianName: z
        .string()
        .min(3)
        .max(150)
        .trim()
        .optional(),

      guardianPhone: z
        .string()
        .min(8)
        .max(20)
        .trim()
        .optional(),

      guardianEmail: z
        .string()
        .email('E-mail do responsável inválido.')
        .max(255)
        .trim()
        .optional()
        .nullable(),

      guardianRelation: z
        .string()
        .max(50)
        .trim()
        .optional()
        .nullable(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      { message: 'Ao menos um campo deve ser informado para atualização.' }
    ),
});

// ── ADD ALLERGY ──────────────────────────────────────────────

export const addAllergySchema = z.object({
  params: z.object({ id: uuidSchema }),
  body: z.object({
    activeIngredient: z
      .string({ required_error: 'Princípio ativo é obrigatório.' })
      .min(2, 'Princípio ativo deve ter pelo menos 2 caracteres.')
      .max(150, 'Princípio ativo não pode exceder 150 caracteres.')
      .trim(),

    allergenName: z
      .string({ required_error: 'Nome do alérgeno é obrigatório.' })
      .min(2, 'Nome do alérgeno deve ter pelo menos 2 caracteres.')
      .max(150)
      .trim(),

    severity: z.enum(['mild', 'moderate', 'severe', 'anaphylactic'], {
      required_error: 'Severidade é obrigatória.',
      errorMap: () => ({
        message: 'Severidade inválida. Use: mild, moderate, severe ou anaphylactic.',
      }),
    }),

    reactionDescription: z
      .string()
      .max(1000, 'Descrição da reação não pode exceder 1000 caracteres.')
      .trim()
      .optional()
      .nullable(),

    diagnosedBy: z
      .string()
      .max(150)
      .trim()
      .optional()
      .nullable(),

    diagnosedAt: dateSchema
      .refine(
        (val) => new Date(val) <= new Date(),
        { message: 'Data de diagnóstico não pode ser no futuro.' }
      )
      .optional()
      .nullable(),
  }),
});

// ── REMOVE ALLERGY ───────────────────────────────────────────

export const removeAllergySchema = z.object({
  params: z.object({
    id: uuidSchema,
    algId: uuidSchema,
  }),
});

// ── STUDENT SEARCH QUERY ─────────────────────────────────────

export const studentSearchSchema = z.object({
  query: z.object({
    q: z
      .string()
      .min(2, 'Busca deve ter pelo menos 2 caracteres.')
      .max(100)
      .trim()
      .optional(),

    gradeClass: z.string().max(20).trim().optional(),

    isActive: z
      .enum(['true', 'false', 'all'])
      .default('true')
      .optional(),

    page: z
      .string()
      .regex(/^\d+$/, 'page deve ser um número inteiro positivo.')
      .optional(),

    limit: z
      .string()
      .regex(/^\d+$/, 'limit deve ser um número inteiro positivo.')
      .optional(),
  }),
});

// ── Tipos inferidos do Zod ───────────────────────────────────
export type CreateStudentInput = z.infer<typeof createStudentSchema>['body'];
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>['body'];
export type AddAllergyInput = z.infer<typeof addAllergySchema>['body'];