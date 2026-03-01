// src/pages/Atendimentos.tsx
// Rota /atendimentos — protegida, requer canDispense (nurse, pharmacist, superadmin)
// Consome:
//   GET  /api/v1/attendances            → lista com filtros e paginação
//   POST /api/v1/attendances            → abre novo atendimento
//   PUT  /api/v1/attendances/:id/close  → encerra atendimento
//   GET  /api/v1/students/search        → busca estudante para abrir atendimento
//   POST /api/v1/dispensations/check    → verifica alergias antes de dispensar
//   POST /api/v1/dispensations          → registra dispensação
//   GET  /api/v1/medications            → lista medicamentos para o select de dispensação
//   GET  /api/v1/medications/:id        → busca lotes do medicamento

import { useEffect, useState } from 'react';
import { Plus, Search, Stethoscope, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermission } from '../hooks/usePermission';
import { useFetch } from '../hooks/useFetch';
import { useDebounce } from '../hooks/useDebounce';
import { attendancesApi } from '../api/attendances';
import { studentsApi } from '../api/students';
import { dispensationsApi } from '../api/dispensations';
import { medicationsApi } from '../api/medications';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { AttendanceBadge } from '../components/ui/Badge';
import type {
  Attendance,
  Student,
  OpenAttendanceResponse,
  Medication,
  MedicationBatch,
  AllergyCheckResult,
} from '../types';

// ── Modal: Abrir atendimento ──────────────────────────────────
function OpenAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [query, setQuery]           = useState('');
  const [student, setStudent]       = useState<Student | null>(null);
  const [symptoms, setSymptoms]     = useState('');
  const [tempC, setTempC]           = useState('');
  const [bp, setBp]                 = useState('');
  const [notes, setNotes]           = useState('');
  const [searching, setSearching]   = useState(false);
  const [results, setResults]       = useState<Student[]>([]);
  const [allergyAlert, setAllergyAlert] = useState<OpenAttendanceResponse['allergyAlerts'] | null>(null);

  const debouncedQuery = useDebounce(query, 300);
  const { execute: openAttendance, isLoading } = useFetch(attendancesApi.open);

  // Busca estudante conforme digita
  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults([]); return; }
    setSearching(true);
    studentsApi.search(debouncedQuery)
      .then(setResults)
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  async function handleSubmit() {
    if (!student) return toast.error('Selecione um estudante.');
    if (symptoms.trim().length < 5) return toast.error('Descreva os sintomas (mín. 5 caracteres).');

    const result = await openAttendance({
      studentId: student.id,
      symptoms: symptoms.trim(),
      clinicalNotes: notes.trim() || null,
      temperatureC: tempC ? parseFloat(tempC) : null,
      bloodPressure: bp.trim() || null,
    });

    if (!result) return;

    if (result.allergyAlerts.hasBlockingAllergies) {
      setAllergyAlert(result.allergyAlerts);
    } else {
      toast.success('Atendimento aberto.');
      onSuccess();
      onClose();
    }
  }

  function handleClose() {
    setQuery(''); setStudent(null); setSymptoms('');
    setTempC(''); setBp(''); setNotes('');
    setResults([]); setAllergyAlert(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Novo Atendimento" size="md">
      {allergyAlert ? (
        // Tela de alerta de alergia grave
        <div className="flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-700">
                Alerta de alergias graves!
              </p>
            </div>
            <p className="text-sm text-red-600">{allergyAlert.warning}</p>
            <ul className="mt-3 space-y-1">
              {allergyAlert.allergies.map((a) => (
                <li key={a.id} className="text-xs text-red-600">
                  • {a.allergenName} — <strong>{a.severity}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={handleClose}>Fechar</Button>
            <Button
              variant="danger"
              onClick={() => { toast.success('Atendimento aberto com alerta.'); onSuccess(); handleClose(); }}
            >
              Ciente, continuar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Busca de estudante */}
          {!student ? (
            <div className="flex flex-col gap-2">
              <Input
                label="Buscar estudante (nome ou matrícula)"
                placeholder="Digite pelo menos 2 caracteres..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                leftIcon={searching ? <Spinner size="sm" /> : <Search className="w-4 h-4" />}
              />
              {results.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {results.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setStudent(s); setQuery(''); setResults([]); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                        <p className="text-xs text-gray-400">{s.enrollmentCode} · {s.gradeClass ?? 'Sem turma'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-brand-800">{student.fullName}</p>
                <p className="text-xs text-brand-600">{student.enrollmentCode} · {student.gradeClass ?? 'Sem turma'}</p>
              </div>
              <button onClick={() => setStudent(null)} className="text-brand-400 hover:text-brand-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {student && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">Sintomas *</label>
                <textarea
                  rows={3}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Descreva os sintomas (mín. 5 caracteres)"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                    resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Temperatura (°C)"
                  type="number"
                  step="0.1"
                  min="30"
                  max="45"
                  placeholder="37.0"
                  value={tempC}
                  onChange={(e) => setTempC(e.target.value)}
                />
                <Input
                  label="Pressão arterial"
                  placeholder="120/80"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Notas clínicas</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações adicionais (opcional)"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                    resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleSubmit} isLoading={isLoading} leftIcon={<Plus className="w-4 h-4" />}>
                  Abrir atendimento
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Modal: Encerrar atendimento ───────────────────────────────
function CloseAttendanceModal({
  attendance,
  onClose,
  onSuccess,
}: {
  attendance: Attendance | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [status, setStatus]               = useState<'closed' | 'referred'>('closed');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [referral, setReferral]           = useState('');
  const { execute: closeAtt, isLoading }  = useFetch(attendancesApi.close);

  async function handleSubmit() {
    if (!attendance) return;
    if (status === 'referred' && !referral.trim()) {
      return toast.error('Informe o destino do encaminhamento.');
    }
    const result = await closeAtt(attendance.id, {
      status,
      clinicalNotes: clinicalNotes.trim() || null,
      referralDestination: status === 'referred' ? referral.trim() : null,
    });
    if (result) { toast.success('Atendimento encerrado.'); onSuccess(); onClose(); }
  }

  return (
    <Modal isOpen={!!attendance} onClose={onClose} title="Encerrar Atendimento" size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Estudante: <strong>{attendance?.student?.fullName ?? '—'}</strong>
        </p>
        <div className="flex gap-3">
          {(['closed', 'referred'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all
                ${status === s
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
            >
              {s === 'closed' ? 'Encerrado' : 'Encaminhado'}
            </button>
          ))}
        </div>
        {status === 'referred' && (
          <Input
            label="Destino do encaminhamento"
            placeholder="Ex: UBS Central, Hospital Municipal..."
            value={referral}
            onChange={(e) => setReferral(e.target.value)}
          />
        )}
        <div>
          <label className="text-sm font-medium text-gray-700">Notas clínicas</label>
          <textarea
            rows={3}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            placeholder="Resumo do atendimento (opcional)"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>Confirmar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────
export function Atendimentos() {
  const { canDispense } = usePermission();
  const [openModal, setOpenModal]         = useState(false);
  const [closing, setClosing]             = useState<Attendance | null>(null);
  const [statusFilter, setStatusFilter]   = useState('');

  const { data, isLoading, execute: fetchList } = useFetch(attendancesApi.list);

  const load = () => fetchList(statusFilter ? { status: statusFilter } : undefined);

  useEffect(() => { load(); }, [statusFilter]);

  const attendances = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Atendimentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total ?? 0} registros encontrados
          </p>
        </div>
        {canDispense && (
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpenModal(true)}>
            Novo atendimento
          </Button>
        )}
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2 flex-wrap">
        {['', 'open', 'dispensed', 'referred', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${statusFilter === s
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
          >
            {s === '' ? 'Todos' : s === 'open' ? 'Em atendimento' : s === 'dispensed'
              ? 'Medicado' : s === 'referred' ? 'Encaminhado' : 'Encerrado'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : attendances.length === 0 ? (
          <EmptyState
            icon={<Stethoscope />}
            title="Nenhum atendimento encontrado"
            description="Tente mudar o filtro ou abra um novo atendimento"
          />
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {attendances.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-gray-800">
                    {att.student?.fullName ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {att.student?.enrollmentCode} · {att.student?.gradeClass ?? 'Sem turma'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(att.attendedAt).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <AttendanceBadge status={att.status} />
                  {att.status === 'open' && canDispense && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setClosing(att)}
                    >
                      Encerrar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modais */}
      <OpenAttendanceModal
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={load}
      />
      <CloseAttendanceModal
        attendance={closing}
        onClose={() => setClosing(null)}
        onSuccess={load}
      />
    </div>
  );
}