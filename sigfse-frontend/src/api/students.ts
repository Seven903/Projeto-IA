// src/api/students.ts
// Conecta com as rotas do backend em src/routes/student.routes.ts:
//   GET    /api/v1/students                        → StudentController.list
//   GET    /api/v1/students/search                 → StudentController.search
//   POST   /api/v1/students                        → StudentController.create
//   GET    /api/v1/students/:id                    → StudentController.getById
//   PUT    /api/v1/students/:id                    → StudentController.update
//   GET    /api/v1/students/:id/health             → StudentController.getHealthProfile
//   POST   /api/v1/students/:id/allergies          → StudentController.addAllergy
//   DELETE /api/v1/students/:id/allergies/:algId   → StudentController.removeAllergy

import { api } from './client';
import type {
  ApiSuccessResponse,
  Student,
  StudentAllergy,
  StudentHealthProfile,
} from '../types';

export const studentsApi = {
  // Query params aceitos pelo studentSearchSchema do backend:
  //   q         → string (mín 2 chars) — busca por nome ou matrícula
  //   gradeClass → string (máx 20)
  //   isActive  → 'true' | 'false' | 'all'  (padrão 'true')
  //   page, limit → inteiros positivos
  list: async (params?: {
    q?: string;
    gradeClass?: string;
    isActive?: 'true' | 'false' | 'all';
    page?: number;
    limit?: number;
  }) => {
    const { data } = await api.get<ApiSuccessResponse<Student[]>>(
      '/students',
      { params }
    );
    return data; // retorna ApiSuccessResponse com data + pagination
  },

  // GET /students/search?q=... — busca rápida para autocomplete
  // O backend aceita q com mín 2 chars (studentSearchSchema)
  search: async (q: string): Promise<Student[]> => {
    const { data } = await api.get<ApiSuccessResponse<Student[]>>(
      '/students/search',
      { params: { q } }
    );
    return data.data;
  },

  // GET /students/:id — retorna Student completo
  getById: async (id: string): Promise<Student> => {
    const { data } = await api.get<ApiSuccessResponse<Student>>(
      `/students/${id}`
    );
    return data.data;
  },

  // GET /students/:id/health — requer canAccessHealthData (nurse, pharmacist, superadmin)
  // Retorna StudentHealthProfile com healthRecord, allergies, allergyCount, hasBlockingAllergies
  getHealthProfile: async (id: string): Promise<StudentHealthProfile> => {
    const { data } = await api.get<ApiSuccessResponse<StudentHealthProfile>>(
      `/students/${id}/health`
    );
    return data.data;
  },

  // POST /students — campos baseados no createStudentSchema do backend
  // lgpdConsent: z.literal(true) — obrigatório e somente true
  // bloodType: opcional, aceito pelo schema mas salvo no healthRecord
  create: async (payload: {
    enrollmentCode: string;
    fullName: string;
    birthDate: string;          // YYYY-MM-DD, não pode ser futuro
    gender?: 'male' | 'female' | 'non_binary' | 'not_informed';
    gradeClass?: string;
    guardianName: string;
    guardianPhone: string;      // mín 8, máx 20 chars
    guardianEmail?: string | null;
    guardianRelation?: string | null;
    lgpdConsent: true;          // z.literal(true) — backend rejeita false
    bloodType?: string | null;
  }): Promise<Student> => {
    const { data } = await api.post<ApiSuccessResponse<Student>>(
      '/students',
      payload
    );
    return data.data;
  },

  // PUT /students/:id — campos do updateStudentSchema, todos opcionais
  // Ao menos um campo deve ser informado (validado pelo backend)
  update: async (
    id: string,
    payload: {
      fullName?: string;
      gender?: 'male' | 'female' | 'non_binary' | 'not_informed';
      gradeClass?: string | null;
      guardianName?: string;
      guardianPhone?: string;
      guardianEmail?: string | null;
      guardianRelation?: string | null;
    }
  ): Promise<Student> => {
    const { data } = await api.put<ApiSuccessResponse<Student>>(
      `/students/${id}`,
      payload
    );
    return data.data;
  },

  // POST /students/:id/allergies — campos do addAllergySchema do backend
  addAllergy: async (
    studentId: string,
    payload: {
      activeIngredient: string;       // mín 2, máx 150 chars
      allergenName: string;           // mín 2, máx 150 chars
      severity: 'mild' | 'moderate' | 'severe' | 'anaphylactic';
      reactionDescription?: string | null;
      diagnosedBy?: string | null;
      diagnosedAt?: string | null;    // YYYY-MM-DD, não pode ser futuro
    }
  ): Promise<StudentAllergy> => {
    const { data } = await api.post<ApiSuccessResponse<StudentAllergy>>(
      `/students/${studentId}/allergies`,
      payload
    );
    return data.data;
  },

  // DELETE /students/:id/allergies/:algId
  // Parâmetro é :algId — definido assim em student.routes.ts
  removeAllergy: async (studentId: string, algId: string): Promise<void> => {
    await api.delete(`/students/${studentId}/allergies/${algId}`);
  },
};