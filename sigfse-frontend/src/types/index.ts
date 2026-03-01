// src/types/index.ts
// Tipos TypeScript do frontend SIGFSE.
// Cada interface espelha EXATAMENTE o que o backend retorna —
// cruzado com models, controllers e dispensation.types.ts do backend.

// ─────────────────────────────────────────────────────────────
// ENVELOPE DE RESPOSTA (responseBuilder.ts do backend)
// ─────────────────────────────────────────────────────────────

export interface ApiMeta {
  timestamp: string;
  requestId: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: ApiMeta;
  pagination?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─────────────────────────────────────────────────────────────
// AUTH
// SystemUser.toSafeObject() → usado em POST /auth/login e GET /auth/me
// ─────────────────────────────────────────────────────────────

export type UserRole = 'nurse' | 'pharmacist' | 'admin' | 'superadmin';

// Shape retornado por toSafeObject() — permissões FLAT
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  councilNumber: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  canAccessHealthData: boolean;
  canDispense: boolean;
  canManageStock: boolean;
}

// Resposta do POST /auth/login
export interface LoginResponse {
  token: string;
  expiresIn: string;
  user: AuthUser;
}

// Shape normalizado usado pelo AuthContext — permissões ANINHADAS
// (unifica AuthUser do toSafeObject com o payload do JWT)
export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  councilNumber: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  permissions: {
    canAccessHealthData: boolean;
    canDispense: boolean;
    canManageStock: boolean;
    canAccessReports: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// ESTUDANTES
// Model: Student.ts
// ─────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'non_binary' | 'not_informed';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'anaphylactic';

export interface Student {
  id: string;
  enrollmentCode: string;
  fullName: string;
  birthDate: string;
  gender: Gender;
  gradeClass: string | null;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  guardianRelation: string | null;
  lgpdConsent: boolean;
  lgpdConsentAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  age?: number; // getter computado, incluído em alguns endpoints
}

// Model: StudentAllergy.ts + getters isLifeThreatening, severityLabel
export interface StudentAllergy {
  id: string;
  studentId: string;
  activeIngredient: string;
  allergenName: string;
  severity: AllergySeverity;
  severityLabel: string;        // getter do model
  isLifeThreatening: boolean;   // getter do model
  reactionDescription: string | null;
  diagnosedBy: string | null;
  diagnosedAt: string | null;
  createdBy: string;
  createdAt: string;
}

// Retorno de GET /students/:id/health (StudentController.getHealthProfile)
export interface StudentHealthProfile {
  student: {
    id: string;
    enrollmentCode: string;
    fullName: string;
    birthDate: string;
    age: number;
    gender: Gender;
    gradeClass: string | null;
    guardianName: string;
    guardianPhone: string;
    guardianEmail: string | null;
    guardianRelation: string | null;
  };
  healthRecord: {
    bloodType: BloodType | null;
    chronicConditions: string[];
    generalNotes: string | null;
  } | null;
  allergies: StudentAllergy[];
  allergyCount: number;           // controller retorna campo flat
  hasBlockingAllergies: boolean;  // controller retorna campo flat
}

// ─────────────────────────────────────────────────────────────
// MEDICAMENTOS
// Model: Medication.ts + MedicationBatch.ts
// ─────────────────────────────────────────────────────────────

export interface Medication {
  id: string;
  sku: string;
  commercialName: string;
  activeIngredient: string;
  dosage: string;
  pharmaceuticalForm: string;
  unitMeasure: string;
  minimumStockQty: number;
  isControlled: boolean;
  requiresPrescription: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalStock?: number; // agregado pelo controller em getById
}

export interface MedicationBatch {
  id: string;
  medicationId: string;
  batchNumber: string;
  manufacturer: string | null;
  quantityTotal: number;
  quantityAvailable: number;
  manufactureDate: string | null;
  expiryDate: string;
  alertDaysBeforeExpiry: number;
  receivedAt: string;
  receivedBy: string;
  notes: string | null;
  createdAt: string;
  // getters do model
  isExpired: boolean;
  isExpiringSoon: boolean;
  isEmpty: boolean;
}

// StockAlertDto do StockService — retornado em GET /medications/stock/alerts
export type AlertLevel = 'critical' | 'warning' | 'info';

export interface StockAlert {
  medicationId: string;
  sku: string;
  commercialName: string;
  activeIngredient: string;
  totalStock: number;
  minimumStockQty: number;
  isLowStock: boolean;
  nearestExpiryDate: string | null;
  isExpiringSoon: boolean;
  hasExpiredBatch: boolean;
  expiryStatusLabel: string;
  alertLevel: AlertLevel;
}

// Retorno de GET /medications/stock/alerts
// controller: sendSuccess(res, { alerts, counts })
export interface StockAlertsResponse {
  alerts: StockAlert[];
  counts: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
}

// ─────────────────────────────────────────────────────────────
// ATENDIMENTOS
// Model: Attendance.ts
// ─────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | 'open'
  | 'dispensed'
  | 'referred'
  | 'closed'
  | 'blocked_allergy';

export interface Attendance {
  id: string;
  studentId: string;
  attendedBy: string;
  attendedAt: string;
  symptoms: string;
  clinicalNotes: string | null;
  temperatureC: number | null;
  bloodPressure: string | null;
  status: AttendanceStatus;
  statusLabel: string;          // getter do model
  referralDestination: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  durationMinutes?: number;     // getter, incluído em getById
  // includes opcionais retornados na listagem
  student?: Pick<Student, 'id' | 'fullName' | 'enrollmentCode' | 'gradeClass'>;
  attendedByUser?: { id: string; fullName: string; role: UserRole };
}

// Retorno de POST /attendances (controller sendCreated)
// { attendance, student, allergyAlerts }
export interface OpenAttendanceResponse {
  attendance: Attendance;
  student: {
    id: string;
    fullName: string;
    enrollmentCode: string;
    gradeClass: string | null;
    age: number;
  };
  allergyAlerts: {
    hasBlockingAllergies: boolean;
    count: number;
    allergies: Pick<StudentAllergy, 'id' | 'allergenName' | 'activeIngredient' | 'severity'>[];
    warning?: string;
  };
}

// ─────────────────────────────────────────────────────────────
// DISPENSAÇÃO
// dispensation.types.ts do backend
// ─────────────────────────────────────────────────────────────

// AllergyConflict (dispensation.types.ts)
export interface AllergyConflict {
  allergyId: string;
  allergenName: string;
  activeIngredient: string;
  severity: AllergySeverity;
  reactionDescription: string | null;
  diagnosedBy: string | null;
}

// AllergyCheckResult (dispensation.types.ts)
export interface AllergyCheckResult {
  safe: boolean;
  conflicts: AllergyConflict[];
  hasBlockingConflict: boolean;
  hasWarningOnly: boolean;
  mostSevereConflict: AllergyConflict | null;
  studentName: string;
  medicationName: string;
  activeIngredientChecked: string;
}

// Retorno de POST /dispensations (controller sendCreated)
export interface DispenseResponse {
  dispensation: {
    id: string;
    attendanceId: string;
    batchId: string;
    medicationName: string;
    activeIngredient: string;
    quantityDispensed: number;
    dosageInstructions: string;
    dispensedBy: string;
    dispensedAt: string;
  };
  allergyCheck: {
    safe: boolean;
    conflictsFound: number;
    warnings: AllergyConflict[];
  };
  remainingStock: number;
  stockAlert?: StockAlert;
}

// Retorno de GET /dispensations/:id
export interface Dispensation {
  id: string;
  attendanceId: string;
  batchId: string;
  dispensedBy: string;
  dispensedAt: string;
  quantityDispensed: number;
  dosageInstructions: string;
  allergyCheckPassed: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// RELATÓRIOS
// ReportService.ts + dispensation.types.ts
// ─────────────────────────────────────────────────────────────

// DashboardSummaryDto (dispensation.types.ts)
export interface DashboardSummary {
  attendancesToday: number;
  attendancesThisMonth: number;
  openAttendances: number;
  stockAlerts: StockAlert[];
  totalStockAlerts: number;
  lastUpdatedAt: string;
}

// HeatmapPointDto (dispensation.types.ts)
export interface HeatmapPoint {
  weekday: number;
  weekdayLabel: string;
  hour: number;
  hourLabel: string;
  count: number;
}

// AbcCurveItemDto (dispensation.types.ts)
export interface AbcItem {
  rank: number;
  medicationId: string;
  commercialName: string;
  activeIngredient: string;
  pharmaceuticalForm: string;
  totalDispensed: number;
  totalEvents: number;
  percentOfTotal: number;
  cumulativePercent: number;
  abcClass: 'A' | 'B' | 'C';
}

// AllergyCoverageDto (dispensation.types.ts)
export interface AllergyCoverage {
  totalActiveStudents: number;
  studentsWithAllergies: number;
  percentWithAllergies: number;
  breakdownBySeverity: {
    anaphylactic: number;
    severe: number;
    moderate: number;
    mild: number;
  };
}

export interface AttendanceByDay {
  date: string;
  count: number;
}

export interface AttendanceByStatus {
  status: AttendanceStatus;
  statusLabel: string;
  count: number;
  percent: number;
}

// ─────────────────────────────────────────────────────────────
// AUDIT LOG
// Model: AuditLog.ts — apenas superadmin via GET /reports/audit
// ─────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  performedBy: string;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  payload: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  performedAt: string;
  createdAt: string;
  performedByUser?: Pick<AuthUser, 'id' | 'fullName' | 'role'>;
}