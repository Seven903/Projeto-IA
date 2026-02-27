# SIGFSE — Sistema Integrado de Gestão de Farmácia e Saúde Escolar

API REST para gerenciamento de atendimentos clínicos, estoque farmacêutico e dispensação de medicamentos em ambiente escolar, com trava de segurança por cross-check de alergia e conformidade LGPD.

---

## Stack

- **Runtime**: Node.js 18+ / TypeScript 5
- **Framework**: Express 4
- **ORM**: Sequelize 6
- **Banco**: SQLite 3 (WAL mode)
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **Validação**: Zod
- **Segurança**: Helmet + CORS

---

## Início rápido

```bash
npm install
cp .env.example .env   # edite JWT_SECRET
npm run db:sync
npm run db:seed
npm run dev
```

Servidor em `http://localhost:3000` — health-check: `GET /api/v1/health`

---

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor com hot-reload |
| `npm run build` | Compila para `dist/` |
| `npm start` | Executa build compilado |
| `npm run db:sync` | Cria/atualiza tabelas |
| `npm run db:sync:force` | Destrói e recria (**dev only**) |
| `npm run db:seed` | Popula dados de teste |
| `npm run db:reset` | sync:force + seed |
| `npm run typecheck` | Verifica tipos sem compilar |

---

## Credenciais de teste (após seed)

| Usuário | E-mail | Senha | Role |
|---------|--------|-------|------|
| Admin | `admin@escola.edu.br` | `Admin@2024!` | admin |
| Enfermeira Ana | `enfermeira.ana@escola.edu.br` | `Enfermeira@2024!` | nurse |
| Farmacêutico João | `farmaceutico.joao@escola.edu.br` | `Farmacia@2024!` | pharmacist |

---

## Cenários de teste de alergia (seed)

| Aluno | Matrícula | Alergia | Severidade | Comportamento |
|-------|-----------|---------|------------|---------------|
| Lucas | `2024001` | dipirona sodica | Anafilática 🚨 | **Bloqueia** Novalgina |
| Beatriz | `2024002` | amoxicilina | Severa ⚠️ | **Bloqueia** Amoxil |
| Carlos | `2024003` | ibuprofeno | Moderada | **Alerta** Advil |

---

## Estrutura do projeto

```
sigfse/
├── src/
│   ├── database/        connection, sync, seed
│   ├── models/          9 models Sequelize + associations
│   ├── services/        AllergyCheck, Dispensation, Stock, Student, Report
│   ├── controllers/     auth, student, medication, attendance, dispensation, report
│   ├── routes/          index + 6 sub-rotas
│   ├── middlewares/     auth, rbac, auditLogger, errorHandler + validate
│   ├── validators/      schemas Zod por domínio
│   ├── types/           express.d.ts, api.types, dispensation.types
│   ├── utils/           normalize, dateHelpers, responseBuilder
│   ├── app.ts
│   └── server.ts
├── data/sigfse.db       (gerado em runtime)
├── .env.example
├── package.json
└── tsconfig.json
```