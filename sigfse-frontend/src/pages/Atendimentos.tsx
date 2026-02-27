import { useEffect, useState } from 'react';
import { Search, Plus, AlertTriangle, ChevronRight, X } from 'lucide-react';
import { attendancesApi } from '../api/attendances';
import { studentsApi } from '../api/students';
import { medicationsApi } from '../api/medications';
import { dispensationsApi } from '../api/dispensations';
import { useApi } from '../hooks/useApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  formatDateTime, statusLabel, statusColor,
  severityLabel, severityColor,
} from '../utils/format';
import type { Attendance, Student, MedicationBatch, Medication } from '../types';
import toast from 'react-hot-toast';

// ── Tela principal ────────────────────────────────────────────
export function Atendimentos() {
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [openModal, setOpenModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);

  const { data: openList, isLoading: loadingOpen, execute: fetchOpen } =
    useApi(attendancesApi.listOpen);
  const { data: allList, isLoading: loadingAll, execute: fetchAll } =
    useApi(() => attendancesApi.list({ limit: 50 }));

  useEffect(() => {
    fetchOpen();
    fetchAll();
  }, []);

  const list = tab === 'open' ? (openList ?? []) : (allList?.data ?? []);
  const isLoading = tab === 'open' ? loadingOpen : loadingAll;

  function handleCreated() {
    fetchOpen();
    fetchAll();
    setOpenModal(false);
  }

  if (selectedAttendance) {
    return (
      <AttendanceDetail
        attendance={selectedAttendance}
        onBack={() => setSelectedAttendance(null)}
        onUpdated={() => { fetchOpen(); fetchAll(); setSelectedAttendance(null); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atendimentos</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os atendimentos da enfermaria</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpenModal(true)}>
          Novo Atendimento
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-5">
        {(['open', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'open' ? `Em aberto ${openList ? `(${openList.length})` : ''}` : 'Todos'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Nenhum atendimento encontrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((att) => (
              <button
                key={att.id}
                onClick={() => setSelectedAttendance(att)}
                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left border border-gray-50 hover:border-gray-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {att.student?.fullName ?? `Atendimento #${att.id.slice(0, 8)}`}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[att.status]}`}>
                      {statusLabel[att.status]}
                    </span>
                    {att.allergyWarning?.hasBlockingAllergies && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        Alergia grave
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{att.symptoms}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{formatDateTime(att.attendedAt)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Novo Atendimento">
        <NovoAtendimentoForm onSuccess={handleCreated} />
      </Modal>
    </div>
  );
}

// ── Formulário de novo atendimento ────────────────────────────
function NovoAtendimentoForm({ onSuccess }: { onSuccess: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [symptoms, setSymptoms] = useState('');
  const [temperature, setTemperature] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function searchStudents(q: string) {
    setQuery(q);
    if (q.length < 2) { setStudentResults([]); return; }
    const results = await studentsApi.search(q);
    setStudentResults(results);
  }

  async function handleSubmit() {
    if (!selectedStudent || !symptoms.trim()) {
      toast.error('Selecione o estudante e descreva os sintomas.');
      return;
    }
    setIsLoading(true);
    try {
      await attendancesApi.open({
        studentId: selectedStudent.id,
        symptoms,
        temperatureC: temperature ? parseFloat(temperature) : undefined,
      });
      toast.success('Atendimento aberto com sucesso!');
      onSuccess();
    } catch {
      // erro já tratado pelo useApi
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Busca de estudante */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Estudante</label>
        {selectedStudent ? (
          <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
            <div>
              <p className="text-sm font-medium text-brand-800">{selectedStudent.fullName}</p>
              <p className="text-xs text-brand-600">Matrícula: {selectedStudent.enrollmentCode}</p>
            </div>
            <button onClick={() => setSelectedStudent(null)}>
              <X className="w-4 h-4 text-brand-400" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Input
              placeholder="Buscar por nome ou matrícula..."
              value={query}
              onChange={(e) => searchStudents(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
            {studentResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {studentResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedStudent(s); setStudentResults([]); setQuery(''); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-900">{s.fullName}</p>
                    <p className="text-xs text-gray-400">{s.enrollmentCode} — {s.gradeClass}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Sintomas *</label>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Descreva os sintomas relatados pelo estudante..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>

      <Input
        label="Temperatura (°C)"
        type="number"
        step="0.1"
        min="35"
        max="42"
        placeholder="Ex: 37.5"
        value={temperature}
        onChange={(e) => setTemperature(e.target.value)}
      />

      <Button className="w-full" onClick={handleSubmit} isLoading={isLoading} size="lg">
        Abrir Atendimento
      </Button>
    </div>
  );
}

// ── Detalhe + Dispensação ─────────────────────────────────────
function AttendanceDetail({
  attendance,
  onBack,
  onUpdated,
}: {
  attendance: Attendance;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [instructions, setInstructions] = useState('');
  const [isDispensing, setIsDispensing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [allergyCheck, setAllergyCheck] = useState<import('../types').AllergyCheckResult | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const { data: medications, execute: fetchMeds } = useApi(() =>
    medicationsApi.list({ isActive: 'true', limit: 100 })
  );
  useEffect(() => { fetchMeds(); }, []);

  const allBatches: Array<MedicationBatch & { medication: Medication }> = [];
  (medications?.data ?? []).forEach((med) => {
    (med as unknown as { batches?: MedicationBatch[] }).batches?.forEach((b) => {
      if (b.quantityAvailable > 0 && !b.isExpired) {
        allBatches.push({ ...b, medication: med });
      }
    });
  });

  async function handleBatchChange(id: string) {
    setBatchId(id);
    if (!id || !attendance.student?.id) return;
    setCheckLoading(true);
    try {
      const result = await dispensationsApi.checkAllergy(attendance.student.id, id);
      setAllergyCheck(result);
    } catch {
      setAllergyCheck(null);
    } finally {
      setCheckLoading(false);
    }
  }

  async function handleDispense() {
    if (!batchId || !instructions.trim()) {
      toast.error('Selecione o medicamento e preencha as instruções de posologia.');
      return;
    }
    if (allergyCheck?.hasBlockingConflict) {
      toast.error('Dispensação bloqueada por alergia grave. Consulte o responsável.');
      return;
    }
    setIsDispensing(true);
    try {
      await dispensationsApi.dispense({
        attendanceId: attendance.id,
        batchId,
        quantityDispensed: parseInt(quantity),
        dosageInstructions: instructions,
      });
      toast.success('Medicamento dispensado com sucesso!');
      onUpdated();
    } catch {
      // erro tratado globalmente
    } finally {
      setIsDispensing(false);
    }
  }

  async function handleClose(status: 'closed' | 'referred') {
    setIsClosing(true);
    try {
      await attendancesApi.close(attendance.id, { status });
      toast.success(status === 'closed' ? 'Atendimento encerrado.' : 'Paciente encaminhado.');
      onUpdated();
    } catch {
      // erro tratado globalmente
    } finally {
      setIsClosing(false);
    }
  }

  const isOpen = attendance.status === 'open';

  return (
    <div>
      <button onClick={onBack} className="text-sm text-brand-600 hover:underline mb-5 flex items-center gap-1">
        ← Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info do atendimento */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Dados do Atendimento">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500 w-28">Estudante</p>
                <p className="text-sm font-medium text-gray-900">
                  {attendance.student?.fullName ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500 w-28">Status</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[attendance.status]}`}>
                  {statusLabel[attendance.status]}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <p className="text-sm text-gray-500 w-28">Sintomas</p>
                <p className="text-sm text-gray-800">{attendance.symptoms}</p>
              </div>
              {attendance.temperatureC && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-500 w-28">Temperatura</p>
                  <p className="text-sm text-gray-800">{attendance.temperatureC}°C</p>
                </div>
              )}
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500 w-28">Data/Hora</p>
                <p className="text-sm text-gray-800">{formatDateTime(attendance.attendedAt)}</p>
              </div>
            </div>
          </Card>

          {/* Alerta de alergia */}
          {attendance.allergyWarning?.hasBlockingAllergies && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <p className="font-semibold text-red-700 text-sm">Alergias graves registradas</p>
              </div>
              <div className="space-y-2">
                {attendance.allergyWarning.allergies.map((a) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityColor[a.severity]}`}>
                      {severityLabel[a.severity]}
                    </span>
                    <span className="text-sm text-red-800">{a.allergenName}</span>
                    <span className="text-xs text-red-500">({a.activeIngredient})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formulário de dispensação */}
          {isOpen && (
            <Card title="Dispensar Medicamento">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Medicamento / Lote
                  </label>
                  <select
                    value={batchId}
                    onChange={(e) => handleBatchChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione um lote disponível...</option>
                    {allBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.medication.commercialName} — Lote {b.batchNumber} (
                        {b.quantityAvailable} un. — vence {b.expiryDate.slice(0, 10)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Resultado do cross-check */}
                {checkLoading && (
                  <p className="text-xs text-gray-400 animate-pulse">Verificando alergias...</p>
                )}
                {allergyCheck && !checkLoading && (
                  <div className={`rounded-lg p-3 text-sm ${
                    allergyCheck.hasBlockingConflict
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : allergyCheck.hasWarningOnly
                      ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                      : 'bg-green-50 border border-green-200 text-green-700'
                  }`}>
                    {allergyCheck.hasBlockingConflict && (
                      <p className="font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        BLOQUEADO — alergia grave detectada
                      </p>
                    )}
                    {allergyCheck.hasWarningOnly && (
                      <p className="font-semibold">⚠️ Atenção — alergia moderada detectada</p>
                    )}
                    {allergyCheck.passed && !allergyCheck.hasWarningOnly && (
                      <p>✓ Nenhuma incompatibilidade encontrada</p>
                    )}
                    {allergyCheck.message && (
                      <p className="mt-1 text-xs opacity-80">{allergyCheck.message}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Quantidade"
                    type="number"
                    min="1"
                    max="100"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Instruções de posologia *
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Ex: Tomar 1 comprimido a cada 8 horas por 5 dias..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                <Button
                  onClick={handleDispense}
                  isLoading={isDispensing}
                  disabled={allergyCheck?.hasBlockingConflict}
                  className="w-full"
                >
                  Confirmar Dispensação
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Ações */}
        {isOpen && (
          <div>
            <Card title="Encerrar Atendimento">
              <div className="space-y-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleClose('closed')}
                  isLoading={isClosing}
                >
                  Encerrar
                </Button>
                <Button
                  variant="secondary"
                  className="w-full text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={() => handleClose('referred')}
                  isLoading={isClosing}
                >
                  Encaminhar
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}