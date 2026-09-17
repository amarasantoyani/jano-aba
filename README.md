# Jano ABA

Aplicação para registrar sessões de terapia ABA, com pacientes, programas,
objetivos e controle de acesso por terapeuta. Desenvolvida para o desafio
técnico da Jano Saúde.

**Demonstração:** https://jano-aba.onrender.com/

As contas são `admin@example.com` e `therapist@example.com`
A senha da demonstração será enviada separadamente. 
Como o serviço é gratuito, pode demorar a abrir após inatividade, 
e o banco gratuito do Render expira 30 dias após sua criação.

## Funcionalidades

- Administrador cadastra e edita pacientes, cria programas e objetivos.
- Exclusões de cadastros respeitam os vínculos e preservam as coletas.
- Programas passam de não iniciados para em andamento e concluídos.
- Administrador concede e revoga acesso dos terapeutas por paciente.
- Terapeuta autorizado registra resultados de objetivos de um ou mais
  programas do mesmo paciente, em uma única sessão.
- O histórico permanece disponível ao administrador após a revogação.

`false` significa que o objetivo foi trabalhado, mas não realizado.
Um objetivo sem registro não foi trabalhado naquela sessão.

## Stack

TypeScript, React, Vite, Express, Prisma e PostgreSQL 17.
O repositório usa npm workspaces. Docker Compose executa apenas o banco local.

## Executar localmente

Requisitos: Node.js 24, npm e Docker com Compose.
Os comandos abaixo usam PowerShell, a partir da raiz do repositório.

```powershell
git clone https://github.com/amarasantoyani/jano-aba.git
cd jano-aba
npm ci
Copy-Item .env.example .env
```

No `.env`, configure `POSTGRES_PASSWORD` e a mesma senha em `DATABASE_URL`
(codificada para URL se contiver caracteres especiais). Mantenha o banco
`jano_aba` e a porta `15432`. Configure `DEMO_PASSWORD` com pelo menos 12
caracteres e `APP_ORIGIN=http://localhost:5173`.

Gere um `SESSION_SECRET` e copie o resultado para o `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
docker compose up -d db
docker compose ps
```

Quando o banco estiver saudável:

```powershell
npm run db:generate --workspace=@jano-aba/backend
npm run db:deploy --workspace=@jano-aba/backend
npm run db:seed --workspace=@jano-aba/backend
npm run dev --workspace=@jano-aba/backend
```

Em outro terminal, na raiz:

```powershell
npm run dev --workspace=@jano-aba/frontend
```

Abra http://localhost:5173. As duas contas usam a `DEMO_PASSWORD` local.
O seed cria as contas iniciais e atualiza seus nomes para admin e terapeuta_1;
não apaga dados nem altera senhas existentes.
O proxy do Vite encaminha `/api` para a porta 3000.

## Testes

Os testes de integração apagam dados somente do banco local reservado
`jano_aba_test`. A configuração rejeita outro nome, host ou porta.
Não use esse banco para armazenar trabalho manual.

Crie o banco uma vez:

```powershell
docker compose exec db sh -c 'createdb -U "$POSTGRES_USER" jano_aba_test'
Copy-Item .env .env.test
```

No `.env.test`, altere apenas o nome do banco em `DATABASE_URL`, de
`jano_aba` para `jano_aba_test`. Mantenha host local, porta 15432,
`APP_ORIGIN` e um `SESSION_SECRET` válido.

```powershell
npm run test:db --workspace=@jano-aba/backend
npm test --workspace=@jano-aba/backend
npm run build
```

A suíte cobre permissões, origem das requisições, concessão concorrente,
resultados true/false, objetivos de outro paciente, duplicidade, programa
concluído e preservação do histórico após revogação. Não é uma suíte
end-to-end do navegador, nem cobre todas as combinações de concorrência.

## Build local

```powershell
npm run build
npm start
```

Para testar o login pela interface compilada em http://localhost:3000,
configure `APP_ORIGIN=http://localhost:3000` antes de iniciar o servidor.
Restaure a origem da porta 5173 ao voltar a usar o Vite.

## Deploy

Um Web Service Node no Render serve a API e o React compilado.
O PostgreSQL fica em um serviço separado, na mesma região.

- Root Directory: vazio.
- Build: `npm ci --include=dev && npm run build`.
- Start: `npm run db:deploy --workspace=@jano-aba/backend && npm run db:seed --workspace=@jano-aba/backend && npm start`.
- Health check: `/api/ready`.
- Ambiente: `NODE_VERSION=24`, `NODE_ENV=production`, `DATABASE_URL`,
  `SESSION_SECRET` e `DEMO_PASSWORD`.
- `DATABASE_URL` recebe a URL interna do PostgreSQL do Render.
- Sem `APP_ORIGIN` explícita, a aplicação usa `RENDER_EXTERNAL_URL`.

O deploy não copia os dados locais. As migrations e o seed são executados
antes do servidor, como simplificação para a demonstração de uma instância.

## Roteiro de avaliação

1. Entre como administrador e cadastre um paciente fictício.
2. Crie programas, adicione objetivos e inicie os programas.
3. Autorize o terapeuta para o paciente.
4. Entre como terapeuta e registre resultados realizados e não realizados.
5. Consulte o histórico como administrador e revogue a autorização.
6. Confirme que o terapeuta perdeu acesso e o administrador mantém o histórico.

## Documentação

- [Requisitos e escopo](docs/requirements.md)
- [Modelo de dados e diagrama](docs/data-model.md)
- [Arquitetura, publicação e evolução](docs/architecture.md)
- [Decisões e alternativas](docs/decisions.md)

## Limites da demonstração

Não há cadastro de usuários pela interface, edição de atendimentos,
relatórios avançados ou suporte a múltiplas clínicas. Os usuários de
avaliação são criados pelo seed. A solução não está preparada para uso
clínico real sem as medidas descritas na evolução da arquitetura.
As dependências transitivas com alertas foram substituídas por overrides.
A justificativa e as verificações estão em docs/decisions.md.
Para conferir a árvore de dependências, foi utilizado npm 11.19.1.
