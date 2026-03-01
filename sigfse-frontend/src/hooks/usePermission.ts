// src/hooks/usePermission.ts
// Encapsula verificações de permissão baseadas no CurrentUser do AuthContext.
// Espelha as regras de RBAC do backend (rbac.middleware.ts + SystemUser getters).
//
// Uso:
//   const { canDispense, canManageStock, isSuperAdmin } = usePermission();
//   {canDispense && <Button>Dispensar</Button>}

import { useAuth } from '../context/AuthContext';

export function usePermission() {
  const { user } = useAuth();

  return {
    // Atalhos de role
    isNurse:      user?.role === 'nurse',
    isPharmacist: user?.role === 'pharmacist',
    isAdmin:      user?.role === 'admin',
    isSuperAdmin: user?.role === 'superadmin',

    // Permissões do backend (SystemUser getters):
    //   nurse, pharmacist, superadmin → canAccessHealthData e canDispense
    //   pharmacist, superadmin        → canManageStock
    //   todos                         → canAccessReports
    canAccessHealthData: user?.permissions.canAccessHealthData ?? false,
    canDispense:         user?.permissions.canDispense         ?? false,
    canManageStock:      user?.permissions.canManageStock      ?? false,
    canAccessReports:    user?.permissions.canAccessReports    ?? false,

    // Ações específicas derivadas das permissões
    canOpenAttendance:   user?.permissions.canDispense      ?? false,
    canCloseAttendance:  user?.permissions.canDispense      ?? false,
    canAddAllergy:       user?.permissions.canAccessHealthData ?? false,
    canReceiveBatch:     user?.permissions.canManageStock   ?? false,
    canCreateMedication: user?.permissions.canManageStock   ?? false,
    canViewAuditLog:     user?.role === 'superadmin',
  };
}