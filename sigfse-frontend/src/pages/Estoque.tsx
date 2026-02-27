// src/pages/Estoque.tsx
import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Package, Search } from 'lucide-react';
import { medicationsApi } from '../api/medications';
import { useApi } from '../hooks/useApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatDate } from '../utils/format';
import type { Medication, AlertLevel } from '../types';
import toast from 'react-hot-toast';

const alertBadgeVariant: Record<AlertLevel, 'danger' | 'warning' | 'info'> = {
  critical: 'danger',
  warning:  'warning',
  info:     'info',
};

export function Estoque() {
  const [search, setSearch] = useState('');
  const [openMedModal, setOpenMedModal] = useState(false);
  const [openBatchModal, setOpenBatchModal] = useState<Medication | null>(null);

  const { data: medsData, isLoading, execute: fetchMeds } =
    useApi(() => medicationsApi.list({ limit: 100 }));
  const { data: alertsData, execute: fetchAlerts } =
    useApi(medicationsApi.getStockAlerts);

  useEffect(() => {
    fetchMeds();
    fetchAlerts();
  }, []);

  const medications = (medsData?.data ?? []).filter((m) =>
    m.commercialName.toLowerCase().includes(search.toLowerCase()) ||
    m.activeIngredient.toLowerCase().includes(search.toLowerCase()) ||
    m.sku.toLowerCase().includes(search.toLowerCase())
  );

  function handleSuccess() {
    fetchMeds();
    fetchAlerts();
    setOpenMedModal(false);
    setOpenBatchModal(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">Medicamentos e controle de lotes</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpenMedModal(true)}>
          Novo Medicamento
        </Button>
      </div>

      {/* Alertas */}
      {alertsData && alertsData.summary.critical > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {(['critical', 'warning', 'info'] as AlertLevel[]).map((level) => (
            alertsData.summary[level] > 0 && (
              <div
                key={level}
                className={`rounded-xl p-4 border flex items-center gap-3 ${
                  level === 'critical' ? 'bg-red-50 border-red-200' :
                  level === 'warning'  ? 'bg-yellow-50 border-yellow-200' :
                                         'bg-blue-50 border-blue-200'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                  level === 'critical' ? 'text-red-500' :
                  level === 'warning'  ? 'text-yellow-500' : 'text-blue-500'
                }`} />
                <div>
                  <p className="text-lg font-bold text-gray-900">{alertsData.summary[level]}</p>
                  <p className="text-xs text-gray-500 capitalize">{level === 'critical' ? 'Crítico' : level === 'warning' ? 'Atenção' : 'Info'}</p>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Lista de alertas */}
      {alertsData && alertsData.alerts.length > 0 && (
        <Card title="Alertas Ativos" className="mb-5">
          <div className="space-y-2">
            {alertsData.alerts.slice(0, 5).map((alert) => (
              <div
                key={`${alert.medicationId}-${alert.batchId}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50"
              >
                <Badge variant={alertBadgeVariant[alert.alertLevel]}>
                  {alert.alertLevel === 'critical' ? 'Crítico' : alert.alertLevel === 'warning' ? 'Atenção' : 'Info'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{alert.commercialName}</p>
                  <p className="text-xs text-gray-400">{alert.alertMessage}</p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">
                  {alert.quantityAvailable} un.
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Busca */}
      <div className="mb-4">
        <Input
          placeholder="Buscar por nome, SKU ou princípio ativo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      {/* Tabela */}
      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : medications.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum medicamento encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Medicamento</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Princípio Ativo</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dosagem</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estoque</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right py-2 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {medications.map((med) => (
                  <tr key={med.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {med.sku}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-medium text-gray-900">{med.commercialName}</p>
                      <p className="text-xs text-gray-400">{med.pharmaceuticalForm}</p>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{med.activeIngredient}</td>
                    <td className="py-3 px-3 text-gray-600">{med.dosage}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-semibold ${
                        (med.totalStock ?? 0) <= med.minimumStockQty
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {med.totalStock ?? 0}
                      </span>
                      <span className="text-xs text-gray-400"> {med.unitMeasure}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={med.isActive ? 'success' : 'default'}>
                        {med.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {med.isControlled && (
                        <Badge variant="warning" className="ml-1">Controlado</Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpenBatchModal(med)}
                      >
                        + Lote
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal novo medicamento */}
      <Modal isOpen={openMedModal} onClose={() => setOpenMedModal(false)} title="Cadastrar Medicamento">
        <NovoMedicamentoForm onSuccess={handleSuccess} />
      </Modal>

      {/* Modal novo lote */}
      <Modal
        isOpen={!!openBatchModal}
        onClose={() => setOpenBatchModal(null)}
        title={`Receber Lote — ${openBatchModal?.commercialName}`}
      >
        {openBatchModal && (
          <NovoLoteForm medicationId={openBatchModal.id} onSuccess={handleSuccess} />
        )}
      </Modal>
    </div>
  );
}

// ── Formulário novo medicamento ───────────────────────────────
function NovoMedicamentoForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    sku: '', commercialName: '', activeIngredient: '',
    dosage: '', pharmaceuticalForm: '', unitMeasure: '',
    isControlled: false, minimumStockQty: 10,
  });
  const [isLoading, setIsLoading] = useState(false);

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    if (!form.sku || !form.commercialName || !form.activeIngredient) {
      toast.error('Preencha SKU, nome comercial e princípio ativo.');
      return;
    }
    setIsLoading(true);
    try {
      await medicationsApi.create({
        ...form,
        activeIngredient: form.activeIngredient.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      });
      toast.success('Medicamento cadastrado!');
      onSuccess();
    } catch {
      // tratado globalmente
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="SKU *" value={form.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} placeholder="MED001" />
        <Input label="Dosagem *" value={form.dosage} onChange={(e) => set('dosage', e.target.value)} placeholder="500mg" />
      </div>
      <Input label="Nome Comercial *" value={form.commercialName} onChange={(e) => set('commercialName', e.target.value)} placeholder="Dipirona Sódica" />
      <Input label="Princípio Ativo *" value={form.activeIngredient} onChange={(e) => set('activeIngredient', e.target.value)} placeholder="dipirona sodica" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Forma Farmacêutica" value={form.pharmaceuticalForm} onChange={(e) => set('pharmaceuticalForm', e.target.value)} placeholder="Comprimido" />
        <Input label="Unidade" value={form.unitMeasure} onChange={(e) => set('unitMeasure', e.target.value)} placeholder="comprimido" />
      </div>
      <Input label="Estoque Mínimo" type="number" value={form.minimumStockQty} onChange={(e) => set('minimumStockQty', parseInt(e.target.value))} />
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" checked={form.isControlled} onChange={(e) => set('isControlled', e.target.checked)} className="rounded" />
        Medicamento controlado
      </label>
      <Button className="w-full" onClick={handleSubmit} isLoading={isLoading}>
        Cadastrar Medicamento
      </Button>
    </div>
  );
}

// ── Formulário novo lote ──────────────────────────────────────
function NovoLoteForm({ medicationId, onSuccess }: { medicationId: string; onSuccess: () => void }) {
  const [form, setForm] = useState({
    batchNumber: '', manufacturer: '',
    quantityTotal: '', expiryDate: '', manufactureDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  async function handleSubmit() {
    if (!form.batchNumber || !form.quantityTotal || !form.expiryDate) {
      toast.error('Preencha número do lote, quantidade e validade.');
      return;
    }
    setIsLoading(true);
    try {
      await medicationsApi.receiveBatch(medicationId, {
        batchNumber: form.batchNumber,
        manufacturer: form.manufacturer || undefined,
        quantityTotal: parseInt(form.quantityTotal),
        expiryDate: form.expiryDate,
        manufactureDate: form.manufactureDate || undefined,
      });
      toast.success('Lote registrado com sucesso!');
      onSuccess();
    } catch {
      // tratado globalmente
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Número do Lote *" value={form.batchNumber} onChange={(e) => set('batchNumber', e.target.value)} placeholder="LOT2024001" />
        <Input label="Fabricante" value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} placeholder="EMS S.A." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Quantidade Total *" type="number" min="1" value={form.quantityTotal} onChange={(e) => set('quantityTotal', e.target.value)} />
        <Input label="Data de Fabricação" type="date" value={form.manufactureDate} onChange={(e) => set('manufactureDate', e.target.value)} />
      </div>
      <Input label="Data de Validade *" type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)} />
      <Button className="w-full" onClick={handleSubmit} isLoading={isLoading}>
        Registrar Entrada
      </Button>
    </div>
  );
}