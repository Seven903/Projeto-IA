// src/pages/Dashboard.tsx
// Rota /dashboard — protegida, acessível para todos os roles
// Consome:
//   GET /api/v1/reports/dashboard       → DashboardSummary
//   GET /api/v1/attendances/open        → Attendance[] (atendimentos em aberto)

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope,
  Pill,
  AlertTriangle,
  Users,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { reportsApi } from '../api/reports';
import { attendancesApi } from '../api/attendances';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { AttendanceBadge } from '../components/ui/Badge';
import type { DashboardSummary, Attendance } from '../types';

// ── Card de métrica ───────────────────────────────────────────
function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    data: summary,
    isLoading: loadingSummary,
    execute: fetchSummary,
  } = useFetch<[], DashboardSummary>(reportsApi.dashboard);

  const {
    data: openAttendances,
    isLoading: loadingOpen,
    execute: fetchOpen,
  } = useFetch<[], Attendance[]>(attendancesApi.listOpen);

  useEffect(() => {
    fetchSummary();
    fetchOpen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = loadingSummary || loadingOpen;

  // Conta alertas críticos de estoque
  const criticalAlerts = summary?.stockAlerts.filter(
    (a) => a.alertLevel === 'critical'
  ).length ?? 0;

  const warningAlerts = summary?.stockAlerts.filter(
    (a) => a.alertLevel === 'warning'
  ).length ?? 0;

  return (
    <div className="flex flex-col gap-6">

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Olá, {user?.fullName?.split(' ')[0]}. Aqui está o resumo de hoje.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Métricas principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Atendimentos hoje"
              value={summary?.attendancesToday ?? 0}
              icon={Stethoscope}
              color="bg-brand-600"
            />
            <MetricCard
              label="Este mês"
              value={summary?.attendancesThisMonth ?? 0}
              icon={TrendingUp}
              color="bg-purple-500"
            />
            <MetricCard
              label="Em aberto agora"
              value={summary?.openAttendances ?? 0}
              icon={Clock}
              color="bg-yellow-500"
            />
            <MetricCard
              label="Alertas de estoque"
              value={summary?.totalStockAlerts ?? 0}
              icon={AlertTriangle}
              color={criticalAlerts > 0 ? 'bg-red-500' : 'bg-orange-400'}
              sub={
                criticalAlerts > 0
                  ? `${criticalAlerts} crítico${criticalAlerts > 1 ? 's' : ''}`
                  : warningAlerts > 0
                    ? `${warningAlerts} atenção`
                    : undefined
              }
            />
          </div>

          {/* Alertas críticos de estoque */}
          {criticalAlerts > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-sm font-semibold text-red-700">
                  {criticalAlerts} medicamento{criticalAlerts > 1 ? 's' : ''} com alerta crítico
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {summary?.stockAlerts
                  .filter((a) => a.alertLevel === 'critical')
                  .slice(0, 4)
                  .map((a) => (
                    <div key={a.medicationId} className="flex items-center justify-between text-sm">
                      <span className="text-red-700 font-medium">{a.commercialName}</span>
                      <span className="text-red-500 text-xs">{a.expiryStatusLabel}</span>
                    </div>
                  ))}
              </div>
              <button
                onClick={() => navigate('/estoque')}
                className="mt-3 text-xs text-red-600 font-medium hover:underline"
              >
                Ver todos os alertas →
              </button>
            </div>
          )}

          {/* Atendimentos em aberto */}
          <Card
            title="Atendimentos em aberto"
            action={
              <button
                onClick={() => navigate('/atendimentos')}
                className="text-xs text-brand-600 font-medium hover:underline"
              >
                Ver todos
              </button>
            }
          >
            {!openAttendances || openAttendances.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-gray-400">
                <Users className="w-5 h-5 mr-2" />
                Nenhum atendimento em aberto
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {openAttendances.slice(0, 5).map((att) => (
                  <button
                    key={att.id}
                    onClick={() => navigate(`/atendimentos`)}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg
                      hover:bg-gray-50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {att.student?.fullName ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {att.student?.enrollmentCode} · {att.student?.gradeClass ?? 'Sem turma'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {new Date(att.attendedAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <AttendanceBadge status={att.status} />
                    </div>
                  </button>
                ))}
                {openAttendances.length > 5 && (
                  <p className="text-xs text-center text-gray-400 pt-1">
                    +{openAttendances.length - 5} atendimento{openAttendances.length - 5 > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Estoque — resumo rápido */}
          {(summary?.stockAlerts.length ?? 0) > 0 && (
            <Card
              title={`Estoque em alerta (${summary?.totalStockAlerts ?? 0})`}
              action={
                <button
                  onClick={() => navigate('/estoque')}
                  className="text-xs text-brand-600 font-medium hover:underline"
                >
                  Gerenciar
                </button>
              }
            >
              <div className="flex flex-col gap-2">
                {summary?.stockAlerts.slice(0, 5).map((a) => (
                  <div key={a.medicationId} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.commercialName}</p>
                      <p className="text-xs text-gray-400">{a.activeIngredient}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{a.expiryStatusLabel}</p>
                      <p className="text-xs font-medium text-gray-700">
                        {a.totalStock} unidades
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

