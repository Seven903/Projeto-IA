import { useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Activity, Users, AlertTriangle, CheckCircle,
  TrendingUp, Clock,
} from 'lucide-react';
import { reportsApi } from '../api/reports';
import { useApi } from '../hooks/useApi';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/format';
import type { AttendanceStatus } from '../types';

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  open:            '#3b82f6',
  dispensed:       '#10b981',
  referred:        '#f59e0b',
  closed:          '#6b7280',
  blocked_allergy: '#ef4444',
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  open:            'Em Atendimento',
  dispensed:       'Medicado',
  referred:        'Encaminhado',
  closed:          'Encerrado',
  blocked_allergy: 'Bloqueado',
};

export function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: loadingSummary, execute: fetchSummary } =
    useApi(reportsApi.dashboard);
  const { data: byDay, execute: fetchByDay } =
    useApi(reportsApi.attendancesByDay);
  const { data: byStatus, execute: fetchByStatus } =
    useApi(reportsApi.attendancesByStatus);

  useEffect(() => {
    fetchSummary();
    fetchByDay();
    fetchByStatus();
  }, []);

  const alertTotal = summary
    ? summary.stockAlerts.critical + summary.stockAlerts.warning
    : 0;

  const metricCards = summary
    ? [
        {
          label: 'Atendimentos Hoje',
          value: summary.attendancesToday,
          icon: Activity,
          color: 'text-brand-600',
          bg: 'bg-brand-50',
        },
        {
          label: 'Este Mês',
          value: summary.attendancesThisMonth,
          icon: TrendingUp,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: 'Em Aberto',
          value: summary.openAttendances,
          icon: Clock,
          color: 'text-orange-500',
          bg: 'bg-orange-50',
        },
        {
          label: 'Alertas de Estoque',
          value: alertTotal,
          icon: alertTotal > 0 ? AlertTriangle : CheckCircle,
          color: alertTotal > 0 ? 'text-red-500' : 'text-green-600',
          bg: alertTotal > 0 ? 'bg-red-50' : 'bg-green-50',
        },
      ]
    : [];

  const pieData = (byStatus ?? []).map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    value: s.count,
    fill: STATUS_COLORS[s.status] ?? '#94a3b8',
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {user?.fullName?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Aqui está o resumo de hoje — {formatDate(new Date().toISOString())}
        </p>
      </div>

      {/* Métricas */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {metricCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alertas de estoque */}
      {summary && summary.stockAlerts.critical > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {summary.stockAlerts.critical} medicamento(s) com estoque crítico
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              Verifique a tela de Estoque para mais detalhes.
            </p>
          </div>
          <Badge variant="danger" className="ml-auto">
            {summary.stockAlerts.critical} crítico(s)
          </Badge>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Linha — atendimentos por dia */}
        <Card title="Atendimentos por dia" className="lg:col-span-2">
          {byDay && byDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={byDay} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatDate(v)}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v) => [v, 'Atendimentos']}
                  labelFormatter={(l) => formatDate(l)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#0284c7' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              Sem dados no período
            </div>
          )}
        </Card>

        {/* Pizza — por status */}
        <Card title="Status dos atendimentos">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  iconSize={8}
                  formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>}
                />
                <Tooltip
                  formatter={(v, n) => [v, n]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              Sem dados
            </div>
          )}
        </Card>
      </div>

      {/* Usuários sem permissão a dados de saúde */}
      {user?.role === 'admin' && (
        <p className="text-xs text-gray-400 mt-6 text-center">
          Você tem acesso apenas a relatórios anonimizados. Dados de saúde individuais são restritos.
        </p>
      )}
    </div>
  );
}