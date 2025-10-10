// src/pages/AvaliacaoPaciente.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import Header from "../components/Header";
import "./AvaliacaoPaciente.css";
import HomemIcon from "../assets/icons/HomemIcon.svg";
import MulherIcon from "../assets/icons/MulherIcon.svg";
import { fetchWithOperator } from "../utils/operator";

function AvaliacaoPaciente({ paciente: pacienteProp }) {
  const { id } = useParams();
  const location = useLocation();
  const statePaciente = location.state?.paciente;

  const paciente = pacienteProp || statePaciente || {

  };

  const avatarInfo = useMemo(() => {
    const candidates = [
      paciente?.genero,
      paciente?.gender,
      paciente?.dadosBasicos?.genero,
      paciente?.sexo,
      paciente?.sex,
    ];
    const raw = candidates.find((value) =>
      typeof value === "string" && value.trim().length > 0
    );
    const normalized = String(raw || "").trim().toLowerCase();
    const isFemale = normalized.startsWith("f") || normalized.startsWith("mulher");
    return {
      icon: isFemale ? MulherIcon : HomemIcon,
      alt: isFemale ? "Foto da paciente" : "Foto do paciente",
    };
  }, [
    paciente?.genero,
    paciente?.gender,
    paciente?.dadosBasicos?.genero,
    paciente?.sexo,
    paciente?.sex,
  ]);

  // Handler corrigido: valida, monta payload esperado pelo backend e salva
  const handleSalvarCorrigido = async () => {
    try {
      const errors = [];
      const pesoNum = parseFloat(String(peso));
      const alturaCmNum = parseFloat(String(altura));
      const alturaM = Number.isFinite(alturaCmNum) ? alturaCmNum / 100 : NaN;
      if (!Number.isFinite(pesoNum)) errors.push("Peso atual inválido");
      if (!Number.isFinite(alturaCmNum) || alturaCmNum <= 0) errors.push("Altura (cm) inválida");
      const circOpcional = [
        ['cintura', cintura],
        ['quadril', quadril],
        ['abdomen', abdomen],
        ['bracoRelaxado', bracoRelaxado],
        ['bracoContraido', bracoContraido],
        ['coxa', coxa],
        ['panturrilha', panturrilha],
      ];
      circOpcional.forEach(([campo, valor]) => {
        const texto = String(valor || '').trim();
        if (!texto) return;
        const numero = parseFloat(texto);
        if (!Number.isFinite(numero)) errors.push(`${campo} inv?lido`);
      });
      const imcCalc = Number.isFinite(pesoNum) && Number.isFinite(alturaM) && alturaM > 0 ? (pesoNum / (alturaM * alturaM)) : NaN;
      if (!Number.isFinite(imcCalc)) errors.push("IMC não pode ser calculado");
      const pid = Number(paciente?.id);
      if (!Number.isFinite(pid)) errors.push("Paciente inválido");
      if (errors.length > 0) { alert("Corrija os campos obrigatórios:\n- " + errors.join("\n- ")); return; }

      const imcStr = imcCalc.toFixed(2);
      const circunferenciasPayload = {
        cintura: String(cintura),
        quadril: String(quadril),
        abdomen: String(abdomen),
        bracoRelaxado: String(bracoRelaxado),
        bracoContraido: String(bracoContraido),
        coxa: String(coxa),
        panturrilha: String(panturrilha),
      };

      const payload = {
        peso: String(peso),
        altura: String(altura),
        imc: imcStr,
        circunferencias: circunferenciasPayload,
      };
      if (metodo3DobrasPayload) {
        payload.metodo3Dobras = metodo3DobrasPayload;
      }

      const res = await fetchWithOperator(`${baseUrl}/evaluations/${pid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Falha ${res.status}`);
      }
      await res.json();
      window.location.assign('/home');
    } catch (e) {
      console.error(e);
      alert('Falha ao salvar a avaliação. Tente novamente.');
    }
  };

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const formatDate = (iso) => {
    if (!iso) return "-";
    const str = String(iso);
    const base = str.includes("T") ? str.split("T")[0] : str;
    const parts = base.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y && m && d) return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
    try {
      const dt = new Date(str);
      if (!Number.isNaN(dt.getTime())) {
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yy = dt.getFullYear();
        return `${dd}/${mm}/${yy}`;
      }
    } catch {}
    return str;
  };

  const calcAgeYears = (birthIso) => {
    if (!birthIso) return null;
    const d = new Date(birthIso);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    return (now - d) / (365.2425 * 24 * 3600 * 1000);
  };

  const nomeCompleto = [paciente?.nome, paciente?.sobrenome].filter(Boolean).join(' ');
  const idadePrecisao = (() => {
    const years = calcAgeYears(paciente?.nascimento);
    if (years != null) return Math.floor(years);
    if (paciente?.idade != null) return Math.floor(Number(paciente.idade));
    return '-';
  })();

  const generoNormalizado = String(paciente?.genero || "").trim().toLowerCase();
  const isFeminino = generoNormalizado.startsWith("f");

  const [ultimaConsultaStr, setUltimaConsultaStr] = useState(null);

  useEffect(() => {
    const pid = Number(paciente?.id);
    if (!Number.isFinite(pid)) { setUltimaConsultaStr(null); return; }
    let aborted = false;
    (async () => {
      try {
        const res = await fetchWithOperator(`${baseUrl}/evaluations/patient/${pid}`);
        if (!res.ok) throw new Error(String(res.status));
        const items = await res.json();
        if (aborted) return;
        if (Array.isArray(items) && items.length > 0) {
          setUltimaConsultaStr(formatDate(items[0]?.createdAt));
          // Autopreencher altura com a da Ãºltima avaliaÃ§Ã£o, se ainda nÃ£o informado
          const alt = items[0]?.alturaCm;
          if ((altura == null || String(altura).trim() === "") && alt != null && !Number.isNaN(alt)) {
            try {
              const val = Math.round(Number(alt));
              if (Number.isFinite(val)) setAltura(String(val));
            } catch {}
          }
        } else {
          setUltimaConsultaStr(null);
        }
      } catch (e) {
        console.error(e);
        if (!aborted) setUltimaConsultaStr(null);
      }
    })();
    return () => { aborted = true; };
  }, [paciente?.id]);

  // Sanitizers: enforce dot as decimal, and digit limits
  const toDigitsMax = (value, maxDigits = 3) => String(value).replace(/\D/g, "").slice(0, maxDigits);
  const toDecimalDot = (value, { maxIntegerDigits, maxDecimalDigits } = {}) => {
    let s = String(value).replace(/[^0-9.]/g, "");
    // keep first dot only
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
      s = s.substring(0, firstDot + 1) + s.substring(firstDot + 1).replace(/\./g, '');
    }
    const hadDot = s.includes('.');
    let [intPart, decPart = ""] = s.split('.');
    if (maxIntegerDigits && maxIntegerDigits > 0) intPart = (intPart || "").slice(0, maxIntegerDigits);
    if (maxDecimalDigits != null && maxDecimalDigits >= 0) decPart = (decPart || "").slice(0, maxDecimalDigits);
    if (decPart.length > 0) return `${intPart || "0"}.${decPart}`;
    if (hadDot) return `${intPart || "0"}.`;
    return intPart || "";
  };
  // permite apenas nÃºmeros, vÃ­rgula e ponto
  const onlyNumbers = (value) => value.replace(/[^0-9.,]/g, "");

  // estado â€” dados bÃ¡sicos
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const imc = useMemo(() => {
    const h = parseFloat(String(altura)) / 100;
    const p = parseFloat(String(peso));
    if (!h || !p) return "";
    const v = p / (h * h);
    return Number.isFinite(v) ? v.toFixed(2) : "";
  }, [peso, altura]);

  // estado â€” circunferÃªncias
  const [cintura, setCintura] = useState("");
  const [quadril, setQuadril] = useState("");
  const [abdomen, setAbdomen] = useState("");
  const [bracoRelaxado, setBracoRelaxado] = useState("");
  const [bracoContraido, setBracoContraido] = useState("");
  const [coxa, setCoxa] = useState("");
  const [panturrilha, setPanturrilha] = useState("");

  // estado â€” mÃ©todo das 3 dobras (mm)
  const [metodoDobras, setMetodoDobras] = useState("");
  const [peitoralMm, setPeitoralMm] = useState("");
  const [abdomenMm, setAbdomenMm] = useState("");
  const [coxaMm, setCoxaMm] = useState("");

  useEffect(() => {
    if (metodoDobras !== "3dobras") {
      setPeitoralMm("");
      setAbdomenMm("");
      setCoxaMm("");
    }
  }, [metodoDobras]);

  const mostrarCampos3Dobras = metodoDobras === "3dobras";
  const metodo3DobrasPayload = mostrarCampos3Dobras
    ? {
        peitoralMm: String(peitoralMm || ""),
        abdomenMm: String(abdomenMm || ""),
        coxaMm: String(coxaMm || ""),
      }
    : null;

  return (
    <div className="page-background">
      <Header mostrarMenu={false} />

      <main className="consulta-container avaliacao-paciente">
        <h1 className="consulta-title">Avaliação de paciente</h1>

        {/* Card do paciente */}
        <section className="paciente-card">
          <div className="avatar">
            <img src={avatarInfo.icon} alt={avatarInfo.alt} className="avatar-icon" />
          </div>
          <div className="paciente-infos">
            <div><strong>Nome:</strong> {nomeCompleto}</div>
            <div><strong>Idade:</strong> {idadePrecisao} anos</div>
            <div><strong>Gênero:</strong> {paciente.genero}</div>
          </div>
          <div className="ultima-consulta">
            <strong>Ultima consulta:</strong> {ultimaConsultaStr ?? "não existem registros."}
          </div>
        </section>

        {/* Dados adicionais */}
        <section className="bloco">
          <p className="bloco-legenda">
           Preencha os dados necessários para iniciar a análise (caso necessário, utilize ponto para separar os números):
          </p>

          <div className="grid-inputs">
            <div className={`float-field ${peso ? 'filled' : ''}`}>
              <label>Peso atual:</label>
              <input
                className="form-input"
                type="text"
                value={peso}
                onChange={(e) => setPeso(toDecimalDot(e.target.value, { maxDecimalDigits: 2 }))}
                inputMode="decimal"
              />
            </div>
            <div className={`float-field ${altura ? 'filled' : ''}`}>
              <label>Altura (cm):</label>
              <input
                className="form-input"
                type="text"
                value={altura}
                onChange={(e) => setAltura(toDigitsMax(e.target.value, 3))}
                inputMode="numeric"
              />
            </div>
            <div className={`float-field ${imc ? 'filled' : ''}`}>
              <label>IMC:</label>
              <input
                className="form-input"
                type="text"
                value={imc}
                readOnly
                title="Calculado automaticamente a partir de peso e altura"
              />
            </div>

          </div>
        </section>

        {/* CircunferÃªncias corporais */}
        <section className="bloco">
          <p className="bloco-legenda">Circunferências corporais:</p>
          <div className="grid-inputs">
            <div className={`float-field ${cintura ? 'filled' : ''}`}>
              <label>Cintura (cm):</label>
              <input
                className="form-input"
                type="text"
                value={cintura}
                onChange={(e) => setCintura(toDecimalDot(e.target.value, { maxIntegerDigits: 3, maxDecimalDigits: 2 }))}
              />
            </div>
            <div className={`float-field ${quadril ? 'filled' : ''}`}>
              <label>Quadril (cm):</label>
              <input
                className="form-input"
                type="text"
                value={quadril}
                onChange={(e) => setQuadril(toDecimalDot(e.target.value, { maxIntegerDigits: 3, maxDecimalDigits: 2 }))}
              />
            </div>
            <div className={`float-field ${abdomen ? 'filled' : ''}`}>
              <label>Abdomen (cm):</label>
              <input
                className="form-input"
                type="text"
                value={abdomen}
                onChange={(e) => setAbdomen(toDecimalDot(e.target.value, { maxIntegerDigits: 3, maxDecimalDigits: 2 }))}
              />
            </div>
            <div className={`float-field ${bracoRelaxado ? 'filled' : ''}`}>
              <label>Braço relaxado (cm):</label>
              <input
                className="form-input"
                type="text"
                value={bracoRelaxado}
                onChange={(e) => setBracoRelaxado(toDecimalDot(e.target.value, { maxIntegerDigits: 3, maxDecimalDigits: 2 }))}
              />
            </div>
            <div className={`float-field ${bracoContraido ? 'filled' : ''}`}>
              <label>Braço contraí­do (cm):</label>
              <input
                className="form-input"
                type="text"
                value={bracoContraido}
                onChange={(e) => setBracoContraido(toDecimalDot(e.target.value, { maxIntegerDigits: 3, maxDecimalDigits: 2 }))}
              />
            </div>
            <div className={`float-field ${coxa ? 'filled' : ''}`}>
              <label>Coxa (cm):</label>
              <input
                className="form-input"
                type="text"
                value={coxa}
                onChange={(e) => setCoxa(toDecimalDot(e.target.value, { maxIntegerDigits: 3, maxDecimalDigits: 2 }))}
              />
            </div>
            <div className={`float-field ${panturrilha ? 'filled' : ''}`}>
              <label>Panturrilha (cm):</label>
              <input
                className="form-input"
                type="text"
                value={panturrilha}
                onChange={(e) => setPanturrilha(toDecimalDot(e.target.value, { maxIntegerDigits: 3, maxDecimalDigits: 2 }))}
              />
            </div>
          </div>

          {/* M?todo de dobras */}
          <p className="bloco-legenda">Método de dobras:</p>
          <div className="grid-inputs">
            <div className="float-field float-field--no-title">
              <select
                className="form-input"
                value={metodoDobras}
                onChange={(e) => setMetodoDobras(e.target.value)}
              >
                <option value="">Nada selecionado</option>
                <option value="3dobras">Jackson-Pollock (3 Dobras)</option>
              </select>
            </div>
          </div>

          {mostrarCampos3Dobras && (
            <>
              <div className="trifold-spacer" />
              
              <div className="grid-inputs">
                <div className={`float-field ${peitoralMm ? 'filled' : ''}`}>
                  <label>{isFeminino ? 'Dobra cutânea tricipital:' : 'Dobra cutânea peitoral (mm):'}</label>
                  <input
                    className="form-input"
                    type="text"
                    value={peitoralMm}
                    onChange={(e) => setPeitoralMm(toDecimalDot(e.target.value, { maxIntegerDigits: 2, maxDecimalDigits: 2 }))}
                  />
                </div>
                <div className={`float-field ${abdomenMm ? 'filled' : ''}`}>
                  <label>{isFeminino ? 'Dobra cutânea supra-ilíaca (mm):' : 'Dobra cutânea abdominal (mm):'}</label>
                  <input
                    className="form-input"
                    type="text"
                    value={abdomenMm}
                    onChange={(e) => setAbdomenMm(toDecimalDot(e.target.value, { maxIntegerDigits: 2, maxDecimalDigits: 2 }))}
                  />
                </div>
                <div className={`float-field ${coxaMm ? 'filled' : ''}`}>
                  <label>Dobra cutânea da coxa (mm):</label>
                  <input
                    className="form-input"
                    type="text"
                    value={coxaMm}
                    onChange={(e) => setCoxaMm(toDecimalDot(e.target.value, { maxIntegerDigits: 2, maxDecimalDigits: 2 }))}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* CTA */}
        <div className="cta-wrap">
          <button className="primary-btn" onClick={handleSalvarCorrigido}>
            Salvar e analisar
          </button>
        </div>
      </main>
    </div>
  );
}

export default AvaliacaoPaciente;









