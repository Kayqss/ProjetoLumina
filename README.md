Lumina Project - Estrutura e Importancia dos Arquivos
====================================================


Tecnologias Utilizadas e Processo de Desenvolvimento
----------------------------------------------------
- **Front-end:** React 19 com Vite 7 para bundling e React Router para navegacao SPA.
- **Estilizacao:** CSS modular por pagina/componentes, com classes utilitarias proprias.
- **Back-end:** Node.js 18+ com Express 4, CORS e JSON nativo; arquitetura RESTful.
- **Banco de Dados:** SQLite via Prisma ORM (migracoes em `prisma/migrations`), com modelos de pacientes, avaliacoes, compromissos e operadores.
- **Autenticacao:** Sessao simples via `localStorage` no front e validacao de operador pelo cabecalho `x-operator-id` no backend.
- **Seguranca:** Hash de senhas com `bcryptjs` e isolamento por operador nas consultas.
- **Integracao com IA:** OpenAI SDK (model `gpt-4o-mini`) para gerar parecer de evolucao, configurado em `server/services/openaiClient.js` e `server/src/services/aiReviewService.js`.
- **Ferramentas de Qualidade:** ESLint moderno (`@eslint/js`, `eslint-plugin-react-hooks`) e scripts npm (`npm run dev`, `npm run build`, `npm start`).


Como Rodar Localmente
---------------------
1. Instale dependencias do frontend: `npm install`
2. Instale dependencias do backend: `cd server && npm install`
3. Gere o cliente Prisma: `npx prisma generate`
4. Sincronize o schema SQLite: `npx prisma db push`
5. Inicie o backend: `npm start` (dentro de `server/`)
6. Inicie o frontend: `npm run dev` (na raiz) e acesse `http://localhost:5173`


Variaveis de Ambiente
---------------------
- `VITE_API_URL` (frontend): URL da API, ex. `http://localhost:4000`
- `OPENAI_API_KEY` (backend): chave da OpenAI
- `DATABASE_URL` (backend): string Prisma/SQLite, ex. `file:./dev.db`
- `BCRYPT_SALT_ROUNDS` (opcional): custo do hash de senha, padrao 12
- Outros segredos devem seguir o mesmo padrao e ficar fora do versionamento


Fluxo de Login e Autorizacao
----------------------------
- O login salva o operador em `localStorage` sob a chave `lumina-operator`
- O utilitario `fetchWithOperator` adiciona `x-operator-id` automaticamente
- Fazer logout remove o item do `localStorage`; tambem e possivel apagar manualmente para trocar de sessao


Banco de Dados e Migracoes
--------------------------
- Banco de desenvolvimento: `server/prisma/dev.db` (SQLite)
- Para reiniciar, remova o arquivo `.db` e execute `npx prisma db push` ou `npx prisma migrate deploy`
- Nunca versionar arquivos `.db` nem `.db-journal`; manter apenas os scripts em `prisma/migrations/`


Raiz do Projeto
---------------
- `.env` - Variaveis de ambiente do frontend (URL da API, chaves). (importancia: alta)
- `.gitignore` - Define o que fica fora do versionamento (logs, env, bancos). (importancia: alta)
- `eslint.config.js` - Configuracao do ESLint para padronizar codigo React/Vite. (importancia: media)
- `index.html` - HTML base do Vite; ponto de entrada da aplicacao. (importancia: alta)
- `package.json`, `package-lock.json` - Scripts e travas de dependencia do frontend. (importancia: alta)
- `start-lumina.bat` - Script Windows que sobe backend e frontend. (importancia: media)
- `vite.config.js` - Configuracao do bundler Vite. (importancia: alta)
- `dist/` - Build final (HTML/CSS/JS minificados e assets); util para deploy. (importancia: alta em producao)
- `node_modules/` - Dependencias instaladas do frontend; recriavel via `npm install`. (importancia: baixa)


Diretorio `src/` (Frontend React)
---------------------------------
- `App.jsx` - Rotas da aplicacao (`/login`, `/home`, etc.). (importancia: alta)
- `main.jsx` - Ponto de montagem do React. (importancia: alta)
- `index.css` - Estilos globais (fontes, layout base). (importancia: alta)


`src/components/`
- `Header.jsx` e `Header.css` - Cabecalho com logo, menu do operador e logout. (importancia: alta)
- `Card.jsx` e `Card.css` - Componente de card reutilizavel na Home. (importancia: media)


`src/pages/`
- `Login.jsx` / `Login.css` - Tela de autenticacao/cadastro de operador. (importancia: alta)
- `Home.jsx` / `Home.css` - Dashboard inicial com resumo e atalhos. (importancia: alta)
- `MeusPacientes.jsx` / `MeusPacientes.css` - Lista e cadastro de pacientes. (importancia: alta)
- `NovaAvaliacao.jsx` / `NovaAvaliacao.css` - Selecao de paciente para nova avaliacao. (importancia: alta)
- `AvaliacaoPaciente.jsx` / `AvaliacaoPaciente.css` - Registro de medicoes e envio ao backend. (importancia: alta)
- `PerfilPaciente.jsx` / `PerfilPaciente.css` - Detalhes, plano alimentar e historico. (importancia: alta)
- `Compromissos.jsx` / `Compromissos.css` - Agenda de compromissos e retornos. (importancia: alta)


`src/assets/`
- `icons/` - Avatares, logos e icones usados pelos componentes. (importancia: alta)
- `images/` - Fundos das telas (login e paginas internas). (importancia: alta)


Diretorio `server/` (Backend Node/Express)
-----------------------------------------
- `.env` - Variaveis secretas do backend (ex. `DATABASE_URL`, `OPENAI_API_KEY`). (importancia: alta)
- `package.json`, `package-lock.json` - Dependencias e scripts do backend. (importancia: alta)
- `README.md` - Guia para iniciar a API. (importancia: media)
- `services/openaiClient.js` - Configura o cliente OpenAI. (importancia: alta se usar IA)
- `src/server.js` - Servidor Express (rotas, middlewares, porta). (importancia: alta)
- `src/routes/patients.js` - CRUD de pacientes, plano alimentar e metas. (importancia: alta)
- `src/routes/evaluations.js` - Avaliacoes corporais e disparo de analise IA. (importancia: alta)
- `src/routes/appointments.js` - Compromissos por operador/paciente. (importancia: alta)
- `src/routes/operators.js` - Cadastro/login de operadores com bcrypt. (importancia: alta)
- `src/services/aiReviewService.js` - Gera parecer da IA sobre evolucao. (importancia: alta se IA ativa)
- `src/utils/operatorContext.js` - Valida o cabecalho `x-operator-id`. (importancia: alta)
- `prisma/schema.prisma` - Modelo de dados completo. (importancia: alta)
- `prisma/migrations/` - Historico de migracoes SQLite. (importancia: media/alta)
- `prisma/dev.db`, `server/dev.db` - Bancos locais; conter dados sensiveis. (importancia: alta)
- `node_modules/` - Dependencias instaladas do backend; recriavel via `npm install`. (importancia: baixa)


