// src/pages/Estudantes.tsx
// Rota /estudantes — protegida, acessível para todos os roles
// Consome:
//   GET    /api/v1/students                      → lista com filtros e paginação
//   POST   /api/v1/students                      → cadastra novo estudante
//   GET    /api/v1/students/:id/health           → prontuário + alergias (requer canAccessHealthData)
//   POST   /api/v1/students/:id/allergies        → adiciona alergia
//   DELETE /api/v1/students/:id/allergies/:algId → remove alergia

import { useEffect, useState } from 'react';
import { Plus, Search, Users, Heart, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermission } from '../hooks/usePermission';
import { useFetch } from '../hooks/useFetch';
import { studentsApi } from '../api/students';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { SeverityBadge } from '../components/ui/Badge';
import type { Student, StudentHealthProfile, AllergySeverity } from '../types';

// ── Modal: Cadastrar estudante ────────────────────────────────
function NewStudentModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { execute: create, isLoading } = useFetch(studentsApi.create);
  const [form, setForm] = useState({
    enrollmentCode: '', fullName: '', birthDate: '',
    gender: 'not_informed' as Student['gender'],
    gradeClass: '', guardianName: '', guardianPhone: '',
    guardianEmail: '', guardianRelation: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSubmit() {
    if (!form.enrollmentCode || !form.fullName || !form.birthDate ||
        !form.guardianName || !form.guardianPhone) {
      return toast.error('Preencha todos os campos obrigatórios.');
    }
    const result = await create({
      ...form,
      lgpdConsent: true,
      guardianEmail: form.guardianEmail || null,
      guardianRelation: form.guardianRelation || null,
    });
    if (result) { toast.success('Estudante cadastrado.'); onSuccess(); onClose(); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Estudante" size="lg">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Matrícula *"        value={form.enrollmentCode} onChange={(e) => set('enrollmentCode', e.target.value)} placeholder="Ex: 2024001" />
        <Input label="Nome completo *"    value={form.fullName}       onChange={(e) => set('fullName', e.target.value)}       placeholder="Nome completo" className="col-span-2 sm:col-span-1" />
        <Input label="Data de nascimento *" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
        <Select
          label="Gênero"
          value={form.gender}
          onChange={(e) => set('gender', e.target.value)}
          options={[
            { value: 'not_informed', label: 'Não informado' },
            { value: 'male',        label: 'Masculino' },
            { value: 'female',      label: 'Feminino' },
            { value: 'non_binary',  label: 'Não-binário' },
          ]}
        />
        <Input label="Turma"              value={form.gradeClass}     onChange={(e) => set('gradeClass', e.target.value)}     placeholder="Ex: 5A" />
        <Input label="Responsável *"      value={form.guardianName}   onChange={(e) => set('guardianName', e.target.value)}   placeholder="Nome do responsável" />
        <Input label="Telefone *"         value={form.guardianPhone}  onChange={(e) => set('guardianPhone', e.target.value)}  placeholder="(11) 99999-9999" />
        <Input label="E-mail do responsável" type="email" value={form.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} placeholder="email@exemplo.com" />
        <Input label="Relação com o aluno" value={form.guardianRelation} onChange={(e) => set('guardianRelation', e.target.value)} placeholder="Ex: Pai, Mãe, Avó..." />
      </div>
      <p className="text-xs text-gray-400 mt-4">
        * O cadastro implica consentimento LGPD do responsável legal.
      </p>
      <div className="flex gap-2 justify-end mt-4">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} isLoading={isLoading} leftIcon={<Plus className="w-4 h-4" />}>
          Cadastrar
        </Button>
      </div>
    </Modal>
  );
}

// ── Modal: Prontuário + alergias ──────────────────────────────
function HealthProfileModal({
  student,
  onClose,
}: {
  student: Student | null;
  onClose: () => void;
}) {
  const { canAddAllergy } = usePermission();
  const [profile, setProfile] = useState<StudentHealthProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingAllergy, setAddingAllergy] = useState(false);
  const [allergyForm, setAllergyForm] = useState({
    activeIngredient: '', allergenName: '',
    severity: 'mild' as AllergySeverity,
    reactionDescription: '',
  });

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    studentsApi.getHealthProfile(student.id)
      .then(setProfile)
      .catch(() => toast.error('Erro ao carregar prontuário.'))
      .finally(() => setLoading(false));
  }, [student]);

  async function handleAddAllergy() {
    if (!student || !allergyForm.activeIngredient || !allergyForm.allergenName) {
      return toast.error('Preencha princípio ativo e nome do alérgeno.');
    }
    try {
      await studentsApi.addAllergy(student.id, {
        ...allergyForm,
        reactionDescription: allergyForm.reactionDescription || null,
      });
      toast.success('Alergia registrada.');
      setAddingAllergy(false);
      setAllergyForm({ activeIngredient: '', allergenName: '', severity: 'mild', reactionDescription: '' });
      const updated = await studentsApi.getHealthProfile(student.id);
      setProfile(updated);
    } catch {
      toast.error('Erro ao registrar alergia.');
    }
  }

  async function handleRemoveAllergy(algId: string) {
    if (!student) return;
    try {
      await studentsApi.removeAllergy(student.id, algId);
      toast.success('Alergia removida.');
      const updated = await studentsApi.getHealthProfile(student.id);
      setProfile(updated);
    } catch {
      toast.error('Erro ao remover alergia.');
    }
  }

  return (
    <Modal isOpen={!!student} onClose={onClose} title="Prontuário do Estudante" size="lg">
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : profile ? (
        <div className="flex flex-col gap-5">
          {/* Dados do estudante */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Nome</span><p className="font-medium">{profile.student.fullName}</p></div>
            <div><span className="text-gray-400">Matrícula</span><p className="font-medium">{profile.student.enrollmentCode}</p></div>
            <div><span className="text-gray-400">Turma</span><p className="font-medium">{profile.student.gradeClass ?? '—'}</p></div>
            <div><span className="text-gray-400">Tipo sanguíneo</span><p className="font-medium">{profile.healthRecord?.bloodType ?? '—'}</p></div>
          </div>

          {/* Alerta de alergias bloqueantes */}
          {profile.hasBlockingAllergies && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600 font-medium">
                Possui alergias severas ou anafiláticas — verificar antes de qualquer medicação
              </p>
            </div>
          )}

          {/* Alergias */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Alergias ({profile.allergyCount})
              </h4>
              {canAddAllergy && (
                <Button size="sm" variant="ghost" leftIcon={<Plus className="w-3 h-3" />}
                  onClick={() => setAddingAllergy(!addingAllergy)}>
                  Adicionar
                </Button>
              )}
            </div>

            {/* Formulário de nova alergia */}
            {addingAllergy && (
              <div className="bg-gray-50 rounded-lg p-4 mb-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Princípio ativo *" value={allergyForm.activeIngredient}
                    onChange={(e) => setAllergyForm(f => ({ ...f, activeIngredient: e.target.value }))}
                    placeholder="Ex: dipirona" />
                  <Input label="Nome do alérgeno *" value={allergyForm.allergenName}
                    onChange={(e) => setAllergyForm(f => ({ ...f, allergenName: e.target.value }))}
                    placeholder="Ex: Dipirona (Novalgina)" />
                </div>
                <Select
                  label="Severidade"
                  value={allergyForm.severity}
                  onChange={(e) => setAllergyForm(f => ({ ...f, severity: e.target.value as AllergySeverity }))}
                  options={[
                    { value: 'mild',         label: 'Leve' },
                    { value: 'moderate',     label: 'Moderada' },
                    { value: 'severe',       label: 'Severa' },
                    { value: 'anaphylactic', label: 'Anafilática ⚠️' },
                  ]}
                />
                <Input label="Descrição da reação (opcional)" value={allergyForm.reactionDescription}
                  onChange={(e) => setAllergyForm(f => ({ ...f, reactionDescription: e.target.value }))}
                  placeholder="Ex: urticária, edema de glote..." />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setAddingAllergy(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleAddAllergy}>Salvar</Button>
                </div>
              </div>
            )}

            {profile.allergies.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma alergia registrada</p>
            ) : (
              <div className="flex flex-col gap-2">
                {profile.allergies.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{a.allergenName}</p>
                      <p className="text-xs text-gray-400">{a.activeIngredient}</p>
                      {a.reactionDescription && (
                        <p className="text-xs text-gray-400 italic mt-0.5">{a.reactionDescription}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      {canAddAllergy && (
                        <button
                          onClick={() => handleRemoveAllergy(a.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────
export function Estudantes() {
  const { canAccessHealthData } = usePermission();
  const [newModal, setNewModal]         = useState(false);
  const [selected, setSelected]         = useState<Student | null>(null);
  const [search, setSearch]             = useState('');

  const { data, isLoading, execute: fetchList } = useFetch(studentsApi.list);
  const load = () => fetchList(search ? { q: search } : undefined);

  useEffect(() => { load(); }, []);

  const students = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Estudantes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total ?? 0} estudantes cadastrados
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setNewModal(true)}>
          Novo estudante
        </Button>
      </div>

      {/* Busca */}
      <div className="flex gap-3">
        <Input
          placeholder="Buscar por nome ou matrícula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          className="max-w-sm"
        />
        <Button variant="secondary" onClick={load}>Buscar</Button>
      </div>

      {/* Tabela */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : students.length === 0 ? (
          <EmptyState icon={<Users />} title="Nenhum estudante encontrado" />
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.fullName}</p>
                  <p className="text-xs text-gray-400">
                    {s.enrollmentCode} · {s.gradeClass ?? 'Sem turma'} · {s.guardianName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!s.isActive && (
                    <span className="text-xs text-gray-400 italic">Inativo</span>
                  )}
                  {canAccessHealthData && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Heart className="w-3 h-3" />}
                      onClick={() => setSelected(s)}
                    >
                      Prontuário
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <NewStudentModal isOpen={newModal} onClose={() => setNewModal(false)} onSuccess={load} />
      <HealthProfileModal student={selected} onClose={() => setSelected(null)} />
    </div>
  );
}