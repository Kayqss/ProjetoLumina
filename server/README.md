# Lumina Backend (Express + Prisma + SQLite)

Este backend fornece endpoints REST para gerenciar pacientes e suas avaliações clínicas, armazenados em um banco de dados SQLite local via Prisma.

## Início Rápido

- Pré-requisitos: Node.js 18+
- Diretório: `server/`

1) Instalar dependências
```
npm install
```

2) Gerar o cliente Prisma e criar o esquema SQLite
```
npx prisma generate
npx prisma db push
```

3) Executar a API
```
npm start
```
A API escuta em `http://localhost:4000`.

## Endpoints

- `GET /health` - verificação de integridade.

Pacientes
- `POST /patients` - cria um paciente
- Corpo: `{ genero, nome, sobrenome, cpf, nascimento: "AAAA-MM-DD", históricoClínico, medicações, alergias }`
- `GET /patients?name=...&cpf=...` - lista/pesquisa pacientes
- `GET /patients/:id` - obtém o paciente pelo id
- `PUT /patients/:id` - atualiza os campos do paciente
- `DELETE /patients/:id` - exclui um paciente (avaliações em cascata)

Avaliações
- `POST /evaluations/:patientId` - cria uma avaliação para um paciente
- Corpo: `{ peso, altura, imc, circunferencias: { cintura, quadril, abdomen, bracoRelaxado, bracoContraído, coxa, panturrilha }, metodo3Dobras: { peitoralMm, abdomenMm, coxaMm } }`
- `GET /evaluations/patient/:patientId` - lista as avaliações de um paciente

## Observações
- O caminho do arquivo do banco de dados é configurado via `.env` (`DATABASE_URL="file:./dev.db"`).
- O CPF é único; tentativas de criar uma duplicata retornam `409`.
- Campos numéricos aceitam strings como `"72,5"` ou `"72.5"`.

Operadores
- `POST /operators/register` - registra uma nova conta de operador
- Corpo: `{ nome, sobrenome, email, senha }`
- `POST /operators/login` - autentica um operador (retorna o perfil básico)
- Corpo: `{ email, senha }`

Observações adicionais
- As senhas dos operadores são criptografadas com bcryptjs. Configure a variável de ambiente opcional `BCRYPT_SALT_ROUNDS` para ajustar o custo de hash (o padrão é 12).