// src/pages/Estoque.tsx
// Rota /estoque — protegida, acessível para todos os roles
// Consome:
//   GET  /api/v1/medications                → lista medicamentos com filtros
//   GET  /api/v1/medications/stock/alerts   → alertas de estoque crítico
//   POST /api/v1/medications                → cadastra medicamento (canManageStock)
//   POST /api/v1/medications/:id/batches    → recebe novo lote (canManageStock)

import { useEffect, useState } from 'react';
import { Plus, Search, Pill, AlertTriangle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermission } from '../hooks/usePermission';
import { useFetch } from '../hooks/useFetch';
import { medicationsApi } from '../api/medications';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { AlertLevelBadge } from '../components/ui/Badge';
import type { Medication, StockAlertsResponse } from '../types';

// ── Modal: Cadastrar medicamento ──────────────────────────────
function NewMedicationModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { execute: create, isLoading } = useFetch(medicationsApi.create);
  const [form, setForm] = useState({
    sku: '', commercialName: '', activeIngredient: '',
    dosage: '', pharmaceuticalForm: '', unitMeasure: '',
    minimumStockQty: '10', isControlled: false, requiresPrescription: false,
  });

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit() {
    if (!form.sku || !form.commercialName || !form.activeIngredient ||
        !form.dosage || !form.pharmaceuticalForm || !form.unitMeasure) {
      return toast.error('Preencha todos os campos obrigatórios.');
    }
    const result = await create({
      ...form,
      minimumStockQty: parseInt(form.minimumStockQty) || 10,
    });
    if (result) { toast.success('Medicamento cadastrado.'); onSuccess(); onClose(); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Medicamento" size="lg">
      <div className="grid grid-cols-2 gap-4">
        <Input label="SKU *"             value={form.sku}              onChange={(e) => set('sku', e.target.value)}              placeholder="Ex: MED001" />
        <Input label="Nome comercial *"  value={form.commercialName}   onChange={(e) => set('commercialName', e.target.value)}   placeholder="Ex: Dipirona 500mg" />
        <Input label="Princípio ativo *" value={form.activeIngredient} onChange={(e) => set('activeIngredient', e.target.value)} placeholder="Ex: dipirona monoidratada" />
        <Input label="Dosagem *"         value={form.dosage}           onChange={(e) => set('dosage', e.target.value)}           placeholder="Ex: 500mg" />
        <Input label="Forma farmacêutica *" value={form.pharmaceuticalForm} onChange={(e) => set('pharmaceuticalForm', e.target.value)} placeholder="Ex: Comprimido" />
        <Input label="Unidade de medida *"  value={form.unitMeasure}       onChange={(e) => set('unitMeasure', e.target.value)}       placeholder="Ex: comprimido" />
        <Input label="Estoque mínimo"    type="number" value={form.minimumStockQty} onChange={(e) => set('minimumStockQty', e.target.value)} />
        <div className="flex flex-col gap-3 col-span-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.isControlled}
              onChange={(e) => set('isControlled', e.target.checked)}
              className="rounded" />
            Medicamento controlado
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.requiresPrescription}
              onChange={(e) => set('requiresPrescription', e.target.checked)}
              className="rounded" />
            Requer prescrição médica
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} isLoading={isLoading} leftIcon={<Plus className="w-4 h-4" />}>
          Cadastrar
        </Button>
      </div>
    </Modal>
  );
}

// ── Modal: Receber lote ───────────────────────────────────────
function NewBatchModal({
  medication,
  onClose,
  onSuccess,
}: {
  medication: Medication | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { execute: receive, isLoading } = useFetch(medicationsApi.receiveBatch);
  const [form, setForm] = useState({
    batchNumber: '', manufacturer: '', quantityTotal: '',
    manufactureDate: '', expiryDate: '', notes: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit() {
    if (!medication) return;
    if (!form.batchNumber || !form.quantityTotal || !form.expiryDate) {
      return toast.error('Preencha número do lote, quantidade e validade.');
    }
    const result = await receive(medication.id, {
      batchNumber: form.batchNumber,
      manufacturer: form.manufacturer || null,
      quantityTotal: parseInt(form.quantityTotal),
      manufactureDate: form.manufactureDate || null,
      expiryDate: form.expiryDate,
      notes: form.notes || null,
    });
    if (result) { toast.success('Lote registrado.'); onSuccess(); onClose(); }
  }

  return (
    <Modal isOpen={!!medication} onClose={onClose} title="Receber Lote" size="md">
      {medication && (
        <div className="flex flex-col gap-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <p className="font-medium text-gray-800">{medication.commercialName}</p>
            <p className="text-gray-400">{medication.activeIngredient} · {medication.dosage}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Número do lote *"  value={form.batchNumber}    onChange={(e) => set('batchNumber', e.target.value)}    placeholder="Ex: LOT2024001" />
            <Input label="Fabricante"        value={form.manufacturer}   onChange={(e) => set('manufacturer', e.target.value)}   placeholder="Ex: EMS" />
            <Input label="Quantidade *"      type="number" min="1"       value={form.quantityTotal}   onChange={(e) => set('quantityTotal', e.target.value)} />
            <Input label="Data de fabricação" type="date" value={form.manufactureDate} onChange={(e) => set('manufactureDate', e.target.value)} />
            <Input label="Data de validade *" type="date" value={form.expiryDate}      onChange={(e) => set('expiryDate', e.target.value)} className="col-span-2 sm:col-span-1" />
          </div>
          <Input label="Observações" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Opcional" />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} isLoading={isLoading} leftIcon={<Package className="w-4 h-4" />}>
              Registrar lote
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────
export function Estoque() {
  const { canManageStock, canCreateMedication } = usePermission();
  const [newMedModal, setNewMedModal] = useState(false);
  const [batchMed, setBatchMed]       = useState<Medication | null>(null);
  const [search, setSearch]           = useState('');
  const [tab, setTab]                 = useState<'list' | 'alerts'>('list');

  const { data: medsData, isLoading: loadingMeds, execute: fetchMeds } =
    useFetch(medicationsApi.list);

  const { data: alertsData, isLoading: loadingAlerts, execute: fetchAlerts } =
    useFetch<[], StockAlertsResponse>(medicationsApi.getStockAlerts);

  const load = () => {
    fetchMeds(search ? { q: search } : undefined);
    fetchAlerts();
  };

  useEffect(() => { load(); }, []);

  const medications = Array.isArray(medsData?.data) ? medsData.data : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Estoque</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {medsData?.pagination?.total ?? 0} medicamentos cadastrados
            {(alertsData?.counts.critical ?? 0) > 0 && (
              <span className="ml-2 text-red-500 font-medium">
                · {alertsData!.counts.critical} crítico{alertsData!.counts.critical > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        {canCreateMedication && (
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setNewMedModal(true)}>
            Novo medicamento
          </Button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['list', 'alerts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px
              ${tab === t
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            {t === 'list' ? 'Medicamentos' : `Alertas (${alertsData?.counts.total ?? 0})`}
          </button>
        ))}
      </div>

      {tab === 'list' ? (
        <>
          {/* Busca */}
          <div className="flex gap-3">
            <Input
              placeholder="Buscar por nome, SKU ou princípio ativo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="max-w-sm"
            />
            <Button variant="secondary" onClick={load}>Buscar</Button>
          </div>

          <Card>
            {loadingMeds ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : medications.length === 0 ? (
              <EmptyState icon={<Pill />} title="Nenhum medicamento encontrado" />
            ) : (
              <div className="flex flex-col divide-y divide-gray-100">
                {medications.map((med) => (
                  <div key={med.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800">{med.commercialName}</p>
                        {med.isControlled && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                            Controlado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {med.activeIngredient} · {med.dosage} · SKU: {med.sku}
                      </p>
                      <p className="text-xs text-gray-400">
                        Estoque mínimo: {med.minimumStockQty} unidades
                      </p>
                    </div>
                    {canManageStock && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Package className="w-3 h-3" />}
                        onClick={() => setBatchMed(med)}
                      >
                        Receber lote
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          {loadingAlerts ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : !alertsData || alertsData.alerts.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle />}
              title="Nenhum alerta de estoque"
              description="Todos os medicamentos estão dentro dos níveis adequados"
            />
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {alertsData.alerts.map((a) => (
                <div key={a.medicationId} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.commercialName}</p>
                    <p className="text-xs text-gray-400">{a.activeIngredient} · SKU: {a.sku}</p>
                    <p className="text-xs text-gray-500 mt-1">{a.expiryStatusLabel}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <AlertLevelBadge level={a.alertLevel} />
                    <p className="text-xs text-gray-500">
                      {a.totalStock} / {a.minimumStockQty} mín.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <NewMedicationModal isOpen={newMedModal} onClose={() => setNewMedModal(false)} onSuccess={load} />
      <NewBatchModal medication={batchMed} onClose={() => setBatchMed(null)} onSuccess={load} />
    </div>
  );
}