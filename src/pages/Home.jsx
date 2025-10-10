import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Card from "../components/Card";
import { fetchWithOperator } from "../utils/operator";

import olhoIcon from "../assets/icons/Olho.svg";
import userIcon from "../assets/icons/User.svg";
import relogioIcon from "../assets/icons/Relogio.svg";
import FotoPerfil from "../assets/icons/FotoPerfil.svg";
import HomemIcon from "../assets/icons/HomemIcon.svg";
import MulherIcon from "../assets/icons/MulherIcon.svg";
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const [retornos, setRetornos] = useState(0);
  const [novas, setNovas] = useState(0);
  const [fimStr, setFimStr] = useState("");
  const [proximos, setProximos] = useState([]);
  const [pacientesCache, setPacientesCache] = useState({});
  const pacientesCacheRef = useRef({});

  useEffect(() => {
    pacientesCacheRef.current = pacientesCache;
  }, [pacientesCache]);

  const parseAppointmentDateTime = (appointment) => {
    const rawDate = String(appointment?.date ?? appointment?.data ?? "").trim();
    if (!rawDate) return null;
    const parts = rawDate.split("-");
    if (parts.length !== 3) return null;
    const [yStr, mStr, dStr] = parts;
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const date = new Date(y, m - 1, d);
    let hasTime = false;
    const rawTime = String(appointment?.time ?? appointment?.hora ?? "").trim();
    const timeMatch = rawTime.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hh = Number(timeMatch[1]);
      const mm = Number(timeMatch[2]);
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        date.setHours(hh, mm, 0, 0);
        hasTime = true;
      }
    }
    if (!hasTime) {
      date.setHours(12, 0, 0, 0);
    }
    return { date, hasTime };
  };

  const formatDateLabel = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "-";
    const formatted = value.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (!formatted) return "-";
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const formatTimeLabel = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "--:--";
    return value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithOperator(`${baseUrl}/appointments`);
        const list = await res.json();
        const items = Array.isArray(list) ? list : [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dow = today.getDay();
        const daysToEnd = 6 - dow;
        const end = new Date(today);
        end.setDate(today.getDate() + daysToEnd);
        const endStr = `${String(end.getDate()).padStart(2, "0")}/${String(end.getMonth() + 1).padStart(2, "0")}/${end.getFullYear()}`;
        setFimStr(endStr);
        const inRange = items.filter((it) => {
          const ds = String(it.date || it.data || "");
          if (!ds) return false;
          const [y, m, d] = ds.split("-").map((x) => parseInt(x, 10));
          if (!y || !m || !d) return false;
          const dt = new Date(y, m - 1, d);
          return dt >= today && dt <= end;
        });
        let r = 0;
        let n = 0;
        inRange.forEach((it) => {
          if (it.patientId != null) r += 1;
          else n += 1;
        });
        setRetornos(r);
        setNovas(n);

        const upcoming = items
          .map((item) => {
            const parsed = parseAppointmentDateTime(item);
            if (!parsed) return null;
            return { item, dateTime: parsed.date, hasTime: parsed.hasTime };
          })
          .filter(Boolean)
          .filter(({ dateTime }) => dateTime >= now)
          .sort((a, b) => a.dateTime - b.dateTime)
          .slice(0, 2)
          .map(({ item, dateTime, hasTime }) => {
            const first = String(item.name || item.nome || "").trim();
            const last = String(item.sobrenome || "").trim();
            const nome = [first, last].filter(Boolean).join(" ") || "Paciente sem nome";
            const comentario = String(item.comment || item.comentario || "").trim();
            let patientId = null;
            const idCandidates = [
              item.patientId,
              item.pacienteId,
              item.patient_id,
              item.patientID,
              item.existingPatientId,
            ];
            for (const value of idCandidates) {
              if (value === undefined || value === null) continue;
              if (typeof value === "number" && Number.isFinite(value)) {
                patientId = value;
                break;
              }
              const numeric = Number(value);
              if (!Number.isNaN(numeric)) {
                patientId = numeric;
                break;
              }
            }
            const hasExisting = typeof patientId === "number";
            const tagLabel = hasExisting ? "(retorno)" : "(novo paciente)";
            const tagClass = hasExisting ? "retorno" : "novo";
            return {
              id: item.id ?? `appointment-${dateTime.getTime()}`,
              nome,
              comentario,
              dateTime,
              temHorario: hasTime,
              tagLabel,
              tagClass,
              patientId,
              original: item,
            };
          });

        setProximos(upcoming);
      } catch {
        setProximos([]);
      }
    })();
  }, [baseUrl]);

  useEffect(() => {
    const ids = new Set();
    proximos.forEach((item) => {
      if (typeof item.patientId === "number" && Number.isFinite(item.patientId)) {
        ids.add(item.patientId);
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
  }, [proximos, baseUrl]);

  const resolveAvatarInfo = (entry) => {
    const cached = entry?.patientId != null ? pacientesCache[entry.patientId] : null;
    const original = entry?.original || {};
    const candidates = [
      cached?.genero,
      cached?.gender,
      cached?.dadosBasicos?.genero,
      original?.genero,
      original?.gender,
      original?.paciente?.genero,
      original?.paciente?.gender,
      original?.sexo,
      original?.sex,
    ];
    const raw = candidates.find((value) =>
      typeof value === "string" && value.trim().length > 0
    );
    if (!raw) {
      return { icon: FotoPerfil, alt: "Foto do paciente" };
    }
    const normalized = String(raw).trim().toLowerCase();
    const isFemale = normalized.startsWith("f") || normalized.startsWith("mulher");
    return {
      icon: isFemale ? MulherIcon : HomemIcon,
      alt: isFemale ? "Foto da paciente" : "Foto do paciente",
    };
  };

  return (
    <div className="page-background">
      <Header />
      <main className="home-main">
        <h1 className="home-title">{`É bom ter você aqui. Como está se sentindo? :)`}</h1>
        <p className="home-summary">
          {(() => {
            if (retornos === 0 && novas === 0) {
              return `Nenhum compromisso agendado até a data de ${fimStr}.`;
            }
            const retStr =
              retornos === 0 ? "nenhum retorno" : `${retornos} retorno${retornos > 1 ? "s" : ""}`;
            const novStr =
              novas === 0
                ? "nenhuma nova consulta"
                : `${novas} nova${novas > 1 ? "s" : ""} consulta${novas > 1 ? "s" : ""}`;
            return `Aqui esta o resumo da sua semana: ${retStr} e ${novStr} ate ${fimStr}.`;
          })()}
        </p>

        <div className="home-card-grid">
          <>
            <Card
              number="01."
              title="Meus pacientes"
              description="Consulte um paciente e seu histórico de consultas."
              actionText="Consultar"
              onClick={() => navigate("/meuspacientes")}
              icon={userIcon}
            />
            <Card
              number="02."
              title="Nova avaliação"
              description="Inicie uma nova avaliação e registre os dados no historico do paciente."
              actionText="Iniciar avaliação"
              onClick={() => navigate("/avaliacao")}
              icon={olhoIcon}
            />
            <Card
              number="03."
              title="Compromissos futuros"
              description="Consulte os seus compromissos e agende novos."
              actionText="Ver compromissos"
              onClick={() => navigate("/compromissos")}
              icon={relogioIcon}
            />
          </>
        </div>

        <section className="home-upcoming">
          <h2 className="home-upcoming-title">Próximas consultas</h2>
          {proximos.length === 0 ? (
            <p className="home-upcoming-empty">Nenhum compromisso futuro encontrado.</p>
          ) : (
            <ul className="home-upcoming-list">
              {proximos.map((item) => {
                const { icon, alt } = resolveAvatarInfo(item);
                return (
                  <li key={item.id} className="home-upcoming-item">
                    <img src={icon} alt={alt} className="home-upcoming-avatar" />
                    <div className="home-upcoming-content">
                      <span className="home-upcoming-name">
                        {item.nome}
                        <span className={`home-upcoming-tag ${item.tagClass}`}>{item.tagLabel}</span>
                      </span>
                      <span className="home-upcoming-meta">
                        {formatDateLabel(item.dateTime)} - {item.temHorario ? formatTimeLabel(item.dateTime) : "--:--"}
                      </span>
                      {item.comentario ? (
                        <span className="home-upcoming-comment">Obs: {item.comentario}</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default Home;









