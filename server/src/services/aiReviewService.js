import { PrismaClient } from "@prisma/client";
import openai from "../../services/openaiClient.js";

const prisma = new PrismaClient();

export async function gerarReviewIA({ patientId }) {
  const numericId = Number(patientId);
  if (!Number.isFinite(numericId)) {
    return;
  }

  try {
    const evaluations = await prisma.evaluation.findMany({
      where: { patientId: numericId },
      orderBy: { createdAt: "desc" },
      take: 2,
    });

    if (evaluations.length < 2) {
      return;
    }

    const [latest, previous] = evaluations;
    const patient = await prisma.patient.findUnique({
      where: { id: numericId },
    });

    if (!patient) {
      return;
    }

    const prompt = montarPrompt({
      patient,
      atual: latest,
      anterior: previous,
    });

    if (!prompt) {
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Voce é um nutricionista. Compare as duas avaliacoes fornecidas e descreva a evolucao em ate tres frases objetivas. Em hipotese alguma cite o nome do paciente",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 250,
      temperature: 0.4,
    });

    const opiniao = response?.choices?.[0]?.message?.content?.trim();
    if (!opiniao) {
      return;
    }

    await prisma.patient.update({
      where: { id: numericId },
      data: { ultimaReviewIA: opiniao },
    });
  } catch (error) {
    console.error("[gerarReviewIA] erro ao gerar review:", error);
  }
}

function montarPrompt({ patient, atual, anterior }) {
  if (!patient || !atual || !anterior) {
    return "";
  }

  const idade = calcularIdade(patient.nascimento);
  const idadeTexto = idade === null ? "nao informada" : `${idade} anos`;
  const nomeCompleto = `${safe(patient.nome)} ${safe(patient.sobrenome)}`.trim();

  const linhas = [
    "Compare as avaliacoes abaixo considerando sinais de melhora, piora ou manutencao.",
    "",
    "Dados do paciente:",
    `Nome: ${nomeCompleto}`,
    `Genero: ${safe(patient.genero)}`,
    `Idade: ${idadeTexto}`,
    `Historico clinico: ${safe(patient.historicoClinico)}`,
    `Medicacoes: ${safe(patient.medicacoes)}`,
    `Alergias: ${safe(patient.alergias)}`,
    `Anotacoes profissionais: ${safe(patient.anotacoes)}`,
    "",
    formatEvaluation("Avaliacao mais recente", atual),
    "",
    formatEvaluation("Avaliacao anterior", anterior),
    "",
    "Responda com um parecer curto destacando mudancas relevantes e recomendacoes objetivas.",
  ];

  return linhas.filter(Boolean).join("\n");
}

function formatEvaluation(titulo, dados) {
  const dobras = [
    `peitoral ${formatNumber(dados.peitoralMm, "mm")}`,
    `abdomen ${formatNumber(dados.abdomenMm, "mm")}`,
    `coxa ${formatNumber(dados.coxaMm, "mm")}`,
  ].join(", ");

  const linhas = [
    `${titulo}:`,
    `Data: ${formatDate(dados.createdAt)}`,
    `Peso: ${formatNumber(dados.peso, "kg")}`,
    `Altura: ${formatNumber(dados.alturaCm, "cm")}`,
    `IMC: ${formatNumber(dados.imc)}`,
    `Cintura: ${formatNumber(dados.cintura, "cm")}`,
    `Quadril: ${formatNumber(dados.quadril, "cm")}`,
    `Abdomen: ${formatNumber(dados.abdomen, "cm")}`,
    `Braco (relaxado): ${formatNumber(dados.bracoRelaxado, "cm")}`,
    `Braco (contraido): ${formatNumber(dados.bracoContraido, "cm")}`,
    `Coxa: ${formatNumber(dados.coxa, "cm")}`,
    `Panturrilha: ${formatNumber(dados.panturrilha, "cm")}`,
    `Dobras: ${dobras}`,
  ];

  return linhas.join("\n");
}

function formatNumber(value, unidade = "") {
  if (value === null || value === undefined) {
    return "nao informado";
  }
  const numero = Number(value);
  if (!Number.isFinite(numero)) {
    return "nao informado";
  }

  const sufixo = unidade ? ` ${unidade}` : "";
  return `${numero.toFixed(2)}${sufixo}`;
}

function formatDate(input) {
  const data = input ? new Date(input) : null;
  if (!data || Number.isNaN(data.getTime())) {
    return "nao informada";
  }
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function calcularIdade(nascimento) {
  if (!nascimento) {
    return null;
  }
  const dataNascimento = new Date(nascimento);
  if (Number.isNaN(dataNascimento.getTime())) {
    return null;
  }

  const hoje = new Date();
  let idade = hoje.getFullYear() - dataNascimento.getFullYear();
  const mes = hoje.getMonth() - dataNascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < dataNascimento.getDate())) {
    idade -= 1;
  }
  return idade;
}

function safe(texto) {
  if (texto === null || texto === undefined || texto === "") {
    return "nao informado";
  }
  return String(texto).trim();
}
