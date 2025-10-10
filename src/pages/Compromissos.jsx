import React, { useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import FotoPerfil from "../assets/icons/FotoPerfil.svg";
import HomemIcon from "../assets/icons/HomemIcon.svg";
import MulherIcon from "../assets/icons/MulherIcon.svg";
import LixeiraIcon from "../assets/icons/LixeiraIcon.svg";
import "./Compromissos.css";
import { fetchWithOperator } from "../utils/operator";

function Compromissos() {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  // UI: novo compromisso
  const [abrirNovo, setAbrirNovo] = useState(false);
  const [tipo, setTipo] = useState("novo"); // 'novo' | 'existente'

  // Novo paciente
  const [novoNome, setNovoNome] = useState("");

  // Paciente existente
  const [buscaNome, setBuscaNome] = useState("");
  const [sugestoes, setSugestoes] = useState([]);
  const [carregandoSug, setCarregandoSug] = useState(false);
  const [pacienteSel, setPacienteSel] = useState(null);
  const sugTimer = useRef(null);

  // Dados do compromisso
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [comentario, setComentario] = useState("");
  const [compromissos, setCompromissos] = useState([]);

  const [pacientesCache, setPacientesCache] = useState({});
  const pacientesCacheRef = useRef({});

  useEffect(() => {
    pacientesCacheRef.current = pacientesCache;
  }, [pacientesCache]);

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
    } catch (error) {
      console.error(error);
    }
    return str;
  };

  const formatLongDate = (input) => {
    if (!input) return "-";
    try {
      const s = String(input);
      // Tratar 'YYYY-MM-DD' como data local (evita deslocamento de fuso)
      const base = s.includes('T') ? s.split('T')[0] : s;
      const parts = base.split('-');
      let d = null;
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(day)) {
          d = new Date(y, m - 1, day);
        }
      }
      if (!d) {
        d = new Date(s);
      }
      if (Number.isNaN(d.getTime())) return s;
      const out = d.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      return String(out).toLowerCase();
    } catch {
      return String(input);
    }
  };


  const getTimeValue = (input) => {
    const raw = String(input ?? '').trim();
    if (!raw) return -1;
    const match = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        return hours * 60 + minutes;
      }
    }
    const asDate = new Date(`1970-01-01T${raw}`);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.getHours() * 60 + asDate.getMinutes();
    }
    return -1;
  };

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const getDateValue = (input) => {
    const raw = String(input ?? '').trim();
    if (!raw) return null;
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      if ([year, month, day].every((n) => Number.isFinite(n))) {
        return new Date(year, month - 1, day);
      }
    }
    const dateOnly = raw.split('T')[0];
    if (dateOnly && dateOnly !== raw) {
      const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        if ([year, month, day].every((n) => Number.isFinite(n))) {
          return new Date(year, month - 1, day);
        }
      }
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
  };

  useEffect(() => {
    if (tipo !== "existente") return;
    const term = String(buscaNome || "").trim();
    if (sugTimer.current) clearTimeout(sugTimer.current);
    if (term.length < 2) {
      setSugestoes([]);
      return;
    }
    sugTimer.current = setTimeout(async () => {
      try {
        setCarregandoSug(true);
        const url = new URL(`${baseUrl}/patients`);
        url.searchParams.set("name", term);
        url.searchParams.set("order", "az");
        const res = await fetchWithOperator(url);
        const list = await res.json();
        setSugestoes(Array.isArray(list) ? list : []);
      } catch {
        setSugestoes([]);
      } finally {
        setCarregandoSug(false);
      }
    }, 300);
  }, [buscaNome, tipo, baseUrl]);

  useEffect(() => {
    let cancelled = false;

    const removeExpired = async (items) => {
      await Promise.all(items.map(async (item) => {
        const id = item?.id;
        if (!id) return;
        try {
          const res = await fetchWithOperator(`${baseUrl}/appointments/${id}`, { method: 'DELETE' });
          if (!res.ok && res.status !== 204) throw new Error(String(res.status));
        } catch (error) {
          console.error('Falha ao remover compromisso expirado.', error);
        }
      }));
    };

    (async () => {
      try {
        const res = await fetchWithOperator(`${baseUrl}/appointments`);
        const list = await res.json();
        if (!Array.isArray(list)) return;

        const now = Date.now();
        const fresh = [];
        const expired = [];

        for (const item of list) {
          const dateValue = getDateValue(item?.date ?? item?.data);
          if (dateValue && now - dateValue.getTime() > THIRTY_DAYS_MS) {
            expired.push(item);
          } else {
            fresh.push(item);
          }
        }

        if (!cancelled) {
          setCompromissos(fresh);
        }

        if (expired.length > 0) {
          await removeExpired(expired);
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseUrl, THIRTY_DAYS_MS]);

  useEffect(() => {
    const ids = new Set();
    compromissos.forEach((c) => {
      const idCandidates = [
        c?.patientId,
        c?.pacienteId,
        c?.patient_id,
        c?.patientID,
        c?.existingPatientId,
      ];
      const raw = idCandidates.find((value) => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'number') return Number.isFinite(value);
        const numeric = Number(value);
        return Number.isFinite(numeric);
      });
      if (raw !== undefined && raw !== null) {
        const numeric = Number(raw);
        if (!Number.isNaN(numeric)) ids.add(numeric);
      }
    });
    const missing = Array.from(ids).filter((id) => !pacientesCacheRef.current[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const responses = await Promise.all(
          missing.map(async (id) => {
            try {
              const res = await fetchWithOperator(`${baseUrl}/patients/${id}`);
              if (!res.ok) return null;
              const data = await res.json();
              return { id, data };
            } catch (error) {
              console.error('Falha ao carregar paciente', id, error);
              return null;
            }
          })
        );
        if (cancelled) return;
        setPacientesCache((prev) => {
          const next = { ...prev };
          responses.forEach((entry) => {
            if (!entry || !entry.data) return;
            next[entry.id] = entry.data;
          });
          return next;
        });
      } catch (error) {
        console.error('Erro ao carregar pacientes relacionados aos compromissos.', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compromissos, baseUrl]);

  const handleSalvarCompromisso = async () => {
    try {
      const nome = tipo === 'novo' ? String(novoNome || '').trim() : (pacienteSel ? `${pacienteSel.nome} ${pacienteSel.sobrenome}`.trim() : '');
      if (!nome) { alert('Informe o nome do paciente.'); return; }
      if (!data) { alert('Selecione a data do compromisso.'); return; }
      if (!hora) { alert('Selecione a hora do compromisso.'); return; }
      const payload = {
        name: nome,
        date: data,
        time: hora,
        comment: comentario || '',
        patientId: pacienteSel?.id ?? null,
      };
      const res = await fetchWithOperator(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      const created = await res.json();
      setCompromissos((prev) => [created, ...prev]);
      // limpar e fechar
      setNovoNome('');
      setBuscaNome('');
      setSugestoes([]);
      setPacienteSel(null);
      setData('');
      setHora('');
      setComentario('');
      setAbrirNovo(false);
    } catch (e) {
      console.error(e);
      alert('Não foi possível criar o compromisso.');
    }
  };

  const resolveAvatarInfo = (appointment) => {
    const idCandidates = [
      appointment?.patientId,
      appointment?.pacienteId,
      appointment?.patient_id,
      appointment?.patientID,
      appointment?.existingPatientId,
    ];
    let numericId = null;
    for (const value of idCandidates) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'number' && Number.isFinite(value)) {
        numericId = value;
        break;
      }
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        numericId = numeric;
        break;
      }
    }
    const cached = numericId != null ? pacientesCache[numericId] : null;
    const candidates = [
      cached?.genero,
      cached?.gender,
      cached?.dadosBasicos?.genero,
      appointment?.genero,
      appointment?.gender,
      appointment?.paciente?.genero,
      appointment?.paciente?.gender,
      appointment?.sexo,
      appointment?.sex,
    ];
    const rawGenero = candidates.find((value) =>
      typeof value === "string" && value.trim().length > 0
    );
    if (!rawGenero) {
      return { icon: FotoPerfil, alt: "Foto do paciente" };
    }
    const normalized = String(rawGenero).trim().toLowerCase();
    const isFemale = normalized.startsWith("f") || normalized.startsWith("mulher");
    return {
      icon: isFemale ? MulherIcon : HomemIcon,
      alt: isFemale ? "Foto da paciente" : "Foto do paciente",
    };
  };

  const handleExcluirCompromisso = async (id, { skipConfirm = false, silent = false } = {}) => {
    try {
      if (!skipConfirm) {
        const ok = window.confirm('Deseja realmente excluir este compromisso?');
        if (!ok) return;
      }
      const res = await fetchWithOperator(`${baseUrl}/appointments/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(String(res.status));
      setCompromissos((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
      if (!silent) {
        alert('Nao foi possivel excluir o compromisso.');
      }
    }
  };

  return (
    <div className="page-background">
      <Header mostrarMenu={false} />

      <main className="compromisso-geral-container">
        <div className="compromisso-header">
          <h1 className="compromisso-geral-title">Compromissos</h1>
          <button
            className={`novo-comp-btn ${abrirNovo ? 'is-open' : ''}`}
            type="button"
            onClick={() => setAbrirNovo((v) => !v)}
            aria-expanded={abrirNovo ? "true" : "false"}
          >
            {abrirNovo ? "Fechar" : "Novo compromisso"}
          </button>
        </div>
        <p className="compromisso-geral-subtitle">Consulte e gerencie seus compromissos futuros.</p>

        {abrirNovo && (
          <section className="novo-comp-card card" aria-label="Novo compromisso">
            <div className="comp-row">
              <label className="comp-radio">
                <input
                  type="radio"
                  name="tipo"
                  checked={tipo === "novo"}
                  onChange={() => { setTipo("novo"); setPacienteSel(null); setBuscaNome(""); }}
                />
                Novo paciente
              </label>
              <label className="comp-radio">
                <input
                  type="radio"
                  name="tipo"
                  checked={tipo === "existente"}
                  onChange={() => { setTipo("existente"); setNovoNome(""); }}
                />
                Paciente existente
              </label>
            </div>

            {tipo === "novo" ? (
              <div className="comp-form">
                <div className="comp-row">
                  <label>Nome do paciente</label>
                  <input
                    className="comp-input"
                    type="text"
                    placeholder=""
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                  />
                </div>
                <div className="comp-row two">
                  <div>
                    <label>Data</label>
                    <input className="comp-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </div>
                  <div>
                    <label>Hora</label>
                    <input className="comp-input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                  </div>
                </div>
                <div className="comp-row">
                  <label>Observação do compromisso:</label>
                  <textarea
                    className="comp-textarea"
                    placeholder=""
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                  />
                </div>
                <div className="comp-actions">
                  <button type="button" className="btn-primary" onClick={handleSalvarCompromisso}>Salvar</button>
                </div>
              </div>
            ) : (
              <div className="comp-form">
                <div className="comp-row">
                  <label>Buscar paciente</label>
                  <input
                    className="comp-input"
                    type="text"
                    placeholder=""
                    value={buscaNome}
                    onChange={(e) => { setBuscaNome(e.target.value); setPacienteSel(null); }}
                  />
                  {carregandoSug && <div className="comp-hint">Carregando...</div>}
                  {!carregandoSug && sugestoes.length > 0 && (
                    <ul className="comp-sugestoes">
                      {sugestoes.map((p) => {
                        const fullName = `${p?.nome || ''} ${p?.sobrenome || ''}`.trim();
                        const nasc = formatDate(p?.nascimento);
                        return (
                          <li key={p.id} onClick={() => { setPacienteSel(p); setBuscaNome(fullName); setSugestoes([]); }}>
                            {p.id} - {fullName || 'Sem nome'} - {nasc}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {pacienteSel && (
                  <div className="comp-selected">Selecionado: {pacienteSel.nome} {pacienteSel.sobrenome} (ID {pacienteSel.id})</div>
                )}
                <div className="comp-row two">
                  <div>
                    <label>Data</label>
                    <input className="comp-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </div>
                  <div>
                    <label>Hora</label>
                    <input className="comp-input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                  </div>
                </div>
                <div className="comp-row">
                  <label>Observação do compromisso:</label>
                  <textarea
                    className="comp-textarea"
                    placeholder=""
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                  />
                </div>
                <div className="comp-actions">
                  <button type="button" className="btn-primary" onClick={handleSalvarCompromisso} disabled={!pacienteSel}>Salvar</button>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="compromisso-content">
          {compromissos.length === 0 ? (
            <p className="placeholder">Nenhum compromisso por enquanto.</p>
          ) : (
            (() => {
              const groups = compromissos.reduce((acc, c) => {
                const key = String(c.date || c.data || '').split('T')[0];
                if (!acc[key]) acc[key] = [];
                acc[key].push(c);
                return acc;
              }, {});
              const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
              return (
                <div style={{ textAlign: 'left' }}>
                  {dates.map((d) => (
                    <div key={d} className="day-group">
                      <div className="day-title">{formatLongDate(d)}</div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {groups[d]
                          .slice()
                          .sort((a, b) => {
                            const aValue = getTimeValue(a.time ?? a.hora);
                            const bValue = getTimeValue(b.time ?? b.hora);
                            if (aValue !== bValue) return bValue - aValue;
                            return String(a.time || a.hora || '').localeCompare(String(b.time || b.hora || ''));
                          })
                          .map((c) => {
                            const nome = c.name || c.nome;
                            const rawTime = c.time ?? c.hora;
                            const comentario = c.comment || c.comentario;
                            const nomeLabel = (String(nome || "").trim() || "Paciente sem nome");
                            const horaLabel = String(rawTime || "").trim() || "--:--";
                            const horaTexto = horaLabel === "--:--" ? "--:--" : `\u00e0s ${horaLabel}`;
                            const comentarioTexto = String(comentario || "").trim();
                            const { icon: avatarIcon, alt: avatarAlt } = resolveAvatarInfo(c);
                            const temPacienteExistente = [
                              c.patientId,
                              c.pacienteId,
                              c.patient_id,
                              c.patientID,
                              c.existingPatientId,
                            ].some((value) => {
                              if (value === undefined || value === null) return false;
                              if (typeof value === "boolean") return value;
                              if (typeof value === "number") return Number.isFinite(value) && value > 0;
                              const numeric = Number(value);
                              if (Number.isFinite(numeric) && numeric > 0) return true;
                              return String(value).trim().length > 0;
                            });
                            const tipoLabel = temPacienteExistente ? "(retorno)" : "(novo paciente)";
                            const tipoClasse = temPacienteExistente ? "compromisso-tag retorno" : "compromisso-tag novo";
                            return (
                              <li key={c.id} className="compromisso-card">
                                <div className="paciente-info">
                                  <img
                                    src={avatarIcon}
                                    alt={avatarAlt}
                                    className="paciente-avatar"
                                  />
                                  <div className="paciente-text">
                                    <div className="compromisso-nome">
                                      <span>{nomeLabel}</span>
                                      <span className={tipoClasse}>{tipoLabel}</span>
                                    </div>
                                    <div className="meta">{horaTexto}</div>
                                    {comentarioTexto ? (
                                      <div className="compromisso-comment">{comentarioTexto}</div>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="compromisso-actions">
                                  <img
                                    src={LixeiraIcon}
                                    alt="Excluir compromisso"
                                    className="trash-btn"
                                    title="Excluir compromisso"
                                    role="button"
                                    tabIndex={0}
                                    draggable={false}
                                    onClick={() => handleExcluirCompromisso(c.id)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        handleExcluirCompromisso(c.id);
                                      }
                                    }}
                                  />
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </main>
    </div>
  );
}

export default Compromissos;
