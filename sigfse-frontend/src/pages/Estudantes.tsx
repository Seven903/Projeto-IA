// src/pages/Estudantes.tsx
import { useEffect, useState } from 'react';
import { Search, Plus, ChevronRight, User, Heart, Trash2 } from 'lucide-react';
import { studentsApi } from '../api/students';
import { useApi } from '../hooks/useApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatDate, severityColor, severityLabel, genderLabel } from '../utils/format';
import type { Student, StudentAllergy, AllergySeverity } from '../types';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export function Estudantes() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Student | null>(null);
  const [openModal, setOpenModal] = useState(false);

  const { data: studentsData, isLoading, execute: fetchStudents } =
    useApi(() => studentsApi.list({ limit: 100 }));

  useEffect(() => { fetchStudents(); }, []);

  const students = (studentsData?.data ?? []).filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.enrollmentCode.includes(search) ||
    (s.gradeClass ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <StudentDetail
        student={selected}
        onBack={() => setSelected(null)}
        canAccessHealth={user?.permissions.canAccessHealthData ?? false}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estudantes</h1>
          <p className="text-gray-500 text-sm mt-1">Cadastro e prontuários</p>
        </div>
        {user?.permissions.canAccessHealthData && (
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpenModal(true)}>
            Novo Estudante
          </Button>
        )}
      </div>

      <div className="mb-4">
        <Input
          placeholder="Buscar por nome, matrícula ou turma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum estudante encontrado.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left border border-transparent hover:border-gray-100"
              >
                <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-sm font-semibold text-brand-700 flex-shrink-0">
                  {s.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.fullName}</p>
                  <p className="text-xs text-gray-400">
                    {s.enrollmentCode}
                    {s.gradeClass && ` — ${s.gradeClass}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!s.isActive && <Badge variant="default">Inativo</Badge>}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={openModal} onClose={() => setOpenModal(false)} title="Cadastrar Estudante" size="lg">
        <NovoEstudanteForm onSuccess={() => { fetchStudents(); setOpenModal(false); }} />
      </Modal>
    </div>
  );
}

// ── Detalhe do estudante ──────────────────────────────────────
function StudentDetail({
  student,
  onBack,
  canAccessHealth,
}: {
  student: Student;
  onBack: () => void;
  canAccessHealth: boolean;
}) {
  const { data: health, isLoading, execute: fetchHealth } =
    useApi(() => studentsApi.getHealthProfile(student.id));
  const [openAllergyModal, setOpenAllergyModal] = useState(false);

  useEffect(() => {
    if (canAccessHealth) fetchHealth();
  }, [canAccessHealth]);

  async function handleRemoveAllergy(allergyId: string) {
    if (!confirm('Remover esta alergia do prontuário?')) return;
    try {
      await studentsApi.removeAllergy(student.id, allergyId);
      toast.success('Alergia removida.');
      fetchHealth();
    } catch {
      // tratado globalmente
    }
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-brand-600 hover:underline mb-5 flex items-center gap-1">
        ← Voltar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Dados pessoais */}
        <Card title="Dados Pessoais" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Nome Completo', value: student.fullName },
              { label: 'Matrícula', value: student.enrollmentCode },
              { label: 'Nascimento', value: formatDate(student.birthDate) },
              { label: 'Gênero', value: genderLabel[student.gender] },
              { label: 'Turma', value: student.gradeClass ?? '—' },
              { label: 'Responsável', value: student.guardianName },
              { label: 'Telefone', value: student.guardianPhone },
              { label: 'E-mail', value: student.guardianEmail ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Status */}
        <Card title="Status">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Situação</p>
              <Badge variant={student.isActive ? 'success' : 'default'}>
                {student.isActive ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            {health && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Tipo Sanguíneo</p>
                <p className="text-sm font-semibold text-gray-900">
                  {health.healthRecord.bloodType ?? 'Não informado'}
                </p>
              </div>
            )}
            {health?.allergyProfile.hasLifeThreateningAllergies && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700">⚠️ Alergias com risco de vida</p>
              </div>
            )}
          </div>
        </Card>

        {/* Prontuário / Alergias */}
        {canAccessHealth && (
          <Card
            title="Alergias Registradas"
            className="lg:col-span-3"
            action={
              <Button size="sm" variant="secondary" leftIcon={<Plus className="w-3 h-3" />}
                onClick={() => setOpenAllergyModal(true)}>
                Adicionar
              </Button>
            }
          >
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !health || health.allergies.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Heart className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma alergia registrada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {health.allergies.map((allergy) => (
                  <div
                    key={allergy.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityColor[allergy.severity]}`}>
                      {severityLabel[allergy.severity]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{allergy.allergenName}</p>
                      <p className="text-xs text-gray-400">Princípio ativo: {allergy.activeIngredient}</p>
                      {allergy.reactionDescription && (
                        <p className="text-xs text-gray-500 mt-0.5">{allergy.reactionDescription}</p>
                      )}
                    </div>
                    {allergy.isLifeThreatening && (
                      <Badge variant="danger">Risco de vida</Badge>
                    )}
                    <button
                      onClick={() => handleRemoveAllergy(allergy.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      <Modal
        isOpen={openAllergyModal}
        onClose={() => setOpenAllergyModal(false)}
        title="Registrar Alergia"
      >
        <AddAllergyForm
          studentId={student.id}
          onSuccess={() => { fetchHealth(); setOpenAllergyModal(false); }}
        />
      </Modal>
    </div>
  );
}

// ── Formulário adicionar alergia ──────────────────────────────
function AddAllergyForm({ studentId, onSuccess }: { studentId: string; onSuccess: () => void }) {
  const [form, setForm] = useState({
    activeIngredient: '', allergenName: '',
    severity: 'moderate' as AllergySeverity,
    reactionDescription: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  async function handleSubmit() {
    if (!form.activeIngredient || !form.allergenName) {
      toast.error('Preencha o princípio ativo e o nome do alérgeno.');
      return;
    }
    setIsLoading(true);
    try {
      await studentsApi.addAllergy(studentId, {
        ...form,
        activeIngredient: form.activeIngredient.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      });
      toast.success('Alergia registrada no prontuário.');
      onSuccess();
    } catch {
      // tratado globalmente
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        label="Nome do Alérgeno *"
        value={form.allergenName}
        onChange={(e) => set('allergenName', e.target.value)}
        placeholder="Ex: Dipirona Sódica"
      />
      <Input
        label="Princípio Ativo *"
        value={form.activeIngredient}
        onChange={(e) => set('activeIngredient', e.target.value)}
        placeholder="Ex: dipirona sodica (sem acentos, minúsculas)"
      />
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Severidade *</label>
        <select
          value={form.severity}
          onChange={(e) => set('severity', e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="mild">Leve</option>
          <option value="moderate">Moderada</option>
          <option value="severe">Severa</option>
          <option value="anaphylactic">Anafilática (risco de vida)</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Descrição da Reação</label>
        <textarea
          value={form.reactionDescription}
          onChange={(e) => set('reactionDescription', e.target.value)}
          rows={2}
          placeholder="Descreva os sintomas da reação alérgica..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>
      <Button className="w-full" onClick={handleSubmit} isLoading={isLoading}>
        Registrar Alergia
      </Button>
    </div>
  );
}

// ── Formulário novo estudante ─────────────────────────────────
function NovoEstudanteForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    enrollmentCode: '', fullName: '', birthDate: '',
    gender: 'not_informed', gradeClass: '',
    guardianName: '', guardianPhone: '', guardianEmail: '',
    lgpdConsent: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const set = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));

  async function handleSubmit() {
    if (!form.enrollmentCode || !form.fullName || !form.birthDate || !form.guardianName || !form.guardianPhone) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    if (!form.lgpdConsent) {
      toast.error('O consentimento LGPD do responsável é obrigatório.');
      return;
    }
    setIsLoading(true);
    try {
      await studentsApi.create({ ...form, lgpdConsent: true });
      toast.success('Estudante cadastrado com sucesso!');
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
        <Input label="Matrícula *" value={form.enrollmentCode} onChange={(e) => set('enrollmentCode', e.target.value)} />
        <Input label="Turma" value={form.gradeClass} onChange={(e) => set('gradeClass', e.target.value)} placeholder="Ex: 5A" />
      </div>
      <Input label="Nome Completo *" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Data de Nascimento *" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Gênero</label>
          <select value={form.gender} onChange={(e) => set('gender', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="not_informed">Não informado</option>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
            <option value="non_binary">Não binário</option>
          </select>
        </div>
      </div>
      <Input label="Nome do Responsável *" value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Telefone *" value={form.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} />
        <Input label="E-mail" type="email" value={form.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} />
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer bg-blue-50 border border-blue-200 rounded-lg p-3">
        <input type="checkbox" checked={form.lgpdConsent} onChange={(e) => set('lgpdConsent', e.target.checked)} className="mt-0.5 rounded" />
        <span>
          <strong>Consentimento LGPD *</strong> — O responsável legal autoriza o armazenamento e tratamento dos dados de saúde do estudante conforme a Lei 13.709/2018.
        </span>
      </label>
      <Button className="w-full" onClick={handleSubmit} isLoading={isLoading}>
        Cadastrar Estudante
      </Button>
    </div>
  );
}