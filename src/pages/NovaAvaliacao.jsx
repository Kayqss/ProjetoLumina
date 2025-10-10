import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import HomemIcon from "../assets/icons/HomemIcon.svg";
import MulherIcon from "../assets/icons/MulherIcon.svg";
import "./NovaAvaliacao.css";
import { fetchWithOperator } from "../utils/operator";

function NovaAvaliacao() {
  const navigate = useNavigate();
  const [buscaNome, setBuscaNome] = useState("");
  const [buscaId, setBuscaId] = useState("");
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [order, setOrder] = useState("id_desc"); // az | za | id_asc | id_desc
  const [showOrderMenu, setShowOrderMenu] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const [ultimaConsultaCache, setUltimaConsultaCache] = useState({});
  const ultimaConsultaCacheRef = useRef({});

  useEffect(() => {
    ultimaConsultaCacheRef.current = ultimaConsultaCache;
  }, [ultimaConsultaCache]);


  // Formata data (YYYY-MM-DD ou ISO) para DD/MM/AAAA
  const formatDate = (iso) => {
    if (!iso) return "-";
    const str = String(iso);
    const base = str.includes("T") ? str.split("T")[0] : str;
    const parts = base.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y && m && d)
        return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
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

  const sortPatients = (arr, ord) => {
    const byIdAsc = (a, b) => (a.id ?? 0) - (b.id ?? 0);
    const byIdDesc = (a, b) => (b.id ?? 0) - (a.id ?? 0);
    const normalize = (s) =>
      String(s || "")
        .normalize?.("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase?.() || String(s || "").toLowerCase();

    const byNameAsc = (a, b) => {
      const an = normalize(a.nome);
      const bn = normalize(b.nome);
      if (an === bn) {
        const as = normalize(a.sobrenome);
        const bs = normalize(b.sobrenome);
        return as.localeCompare(bs, undefined, { sensitivity: "base" });
      }
      return an.localeCompare(bn, undefined, { sensitivity: "base" });
    };
    const byNameDesc = (a, b) => -byNameAsc(a, b);
    const copy = Array.isArray(arr) ? arr.slice() : [];
    switch (ord) {
      case "az":
        return copy.sort(byNameAsc);
      case "za":
        return copy.sort(byNameDesc);
      case "id_asc":
        return copy.sort(byIdAsc);
      case "id_desc":
        return copy.sort(byIdDesc);
      default:
        return copy;
    }
  };

  const sortedResultados = useMemo(
    () => sortPatients(resultados, order),
    [resultados, order]
  );

  useEffect(() => {
    const ids = new Set();
    if (Array.isArray(sortedResultados)) {
      sortedResultados.forEach((p) => {
        const id = Number(p?.id);
        if (Number.isFinite(id)) ids.add(id);
      });
    }
    const missing = Array.from(ids).filter((id) =>
      ultimaConsultaCacheRef.current[id] === undefined
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const responses = await Promise.all(
          missing.map(async (id) => {
            try {
              const res = await fetchWithOperator(`${baseUrl}/evaluations/patient/${id}`);
              if (!res.ok) throw new Error(String(res.status));
              const items = await res.json();
              let value = "Sem registro";
              if (Array.isArray(items) && items.length > 0) {
                const latest = items
                  .slice()
                  .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))[0];
                const formatted = formatDate(latest?.createdAt);
                if (formatted) value = formatted;
              }
              return { id, value };
            } catch (error) {
              console.error("Falha ao carregar ultima consulta do paciente", id, error);
              return { id, value: "Sem registro" };
            }
          })
        );
        if (cancelled) return;
        setUltimaConsultaCache((prev) => {
          const next = { ...prev };
          responses.forEach(({ id, value }) => {
            if (id == null || next[id] !== undefined) return;
            next[id] = value;
          });
          return next;
        });
      } catch (error) {
        console.error("Erro ao buscar ultimas consultas (nova avaliacao).", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sortedResultados, baseUrl]);

  const resolvePacienteAvatar = (paciente) => {
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
    if (!raw) {
      return { icon: HomemIcon, alt: "Foto do paciente" };
    }
    const normalized = String(raw).trim().toLowerCase();
    const isFemale = normalized.startsWith("f") || normalized.startsWith("mulher");
    return {
      icon: isFemale ? MulherIcon : HomemIcon,
      alt: isFemale ? "Foto da paciente" : "Foto do paciente",
    };
  };

  const handleBuscar = async () => {
    try {
      setErro("");
      setCarregando(true);
      setResultados([]);
      setBuscou(true);

      const idNum = Number(buscaId);
      if (buscaId && Number.isFinite(idNum)) {
        const res = await fetchWithOperator(`${baseUrl}/patients/${idNum}`);
        if (res.status === 404) {
          setResultados([]);
        } else if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Falha ${res.status}`);
        } else {
          const p = await res.json();
          setResultados(p ? [p] : []);
        }
      } else if (buscaNome && buscaNome.trim().length > 0) {
        const url = new URL(`${baseUrl}/patients`);
        url.searchParams.set("name", buscaNome);
        url.searchParams.set("order", order);
        const res = await fetchWithOperator(url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Falha ${res.status}`);
        }
        const list = await res.json();
        setResultados(Array.isArray(list) ? list : []);
      } else {
        setErro("Informe o nome ou o ID do paciente para buscar.");
      }
    } catch (e) {
      console.error(e);
      setErro("Erro ao buscar pacientes.");
    } finally {
      setCarregando(false);
    }
  };

  const handleLimpar = () => {
    setBuscaNome("");
    setBuscaId("");
    setResultados([]);
    setErro("");
    setBuscou(false);
  };

  // Reaplica ordenação ao mudar o filtro, se há termo de busca
  useEffect(() => {
    if (
      (buscaNome && buscaNome.trim()) ||
      (buscaId && String(buscaId).trim())
    ) {
      handleBuscar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <div className="page-background">
      <Header mostrarMenu={false} />
      <main className="nova-avaliacao-container">
        <h1 className="nova-avaliacao-title">Nova Avaliação</h1>
        <p className="nova-avaliacao-desc">
          Inicie por aqui uma avaliação com um paciente.
        </p>

        {/* Formulário de busca de paciente */}
        <div className="form-container">
          <div className="inline-inputs">
            <input
              type="text"
              placeholder="Nome do paciente"
              className="form-input nome-input"
              aria-label="Nome do paciente"
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
            />
            <input
              type="text"
              placeholder="ID do paciente"
              className="form-input id-input"
              aria-label="ID do paciente"
              value={buscaId}
              onChange={(e) => setBuscaId(e.target.value)}
            />
            <button
              className="search-btn"
              onClick={handleBuscar}
              aria-label="Buscar paciente"
            >
              Buscar
            </button>
            <div style={{ position: "relative" }}>
              <button
                className="search-btn"
                onClick={() => setShowOrderMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showOrderMenu}
              >
                Filtro
              </button>
              {showOrderMenu && (
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    top: "110%",
                    right: 0,
                    background: "#fff",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                    zIndex: 20,
                    minWidth: 200,
                    overflow: "hidden",
                  }}
                >
                  <button
                    role="menuitemradio"
                    aria-checked={order === "az"}
                    onClick={() => {
                      setOrder("az");
                      setShowOrderMenu(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      background: order === "az" ? "#f3f4f6" : "#fff",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    A-Z (alfabética)
                  </button>
                  <button
                    role="menuitemradio"
                    aria-checked={order === "za"}
                    onClick={() => {
                      setOrder("za");
                      setShowOrderMenu(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      background: order === "za" ? "#f3f4f6" : "#fff",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    Z-A (alfabética inversa)
                  </button>
                  <button
                    role="menuitemradio"
                    aria-checked={order === "id_desc"}
                    onClick={() => {
                      setOrder("id_desc");
                      setShowOrderMenu(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      background: order === "id_desc" ? "#f3f4f6" : "#fff",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    IDs (decrescente)
                  </button>
                  <button
                    role="menuitemradio"
                    aria-checked={order === "id_asc"}
                    onClick={() => {
                      setOrder("id_asc");
                      setShowOrderMenu(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      background: order === "id_asc" ? "#f3f4f6" : "#fff",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    IDs (crescente)
                  </button>
                </div>
              )}
            </div>
            {buscou && (
              <button
                className="search-btn cancel-btn"
                onClick={handleLimpar}
                aria-label="Limpar busca"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Linha divisória padrão */}
        <hr className="divider" />

        <div className="form-container">
          {erro && (
            <p className="register-hint" style={{ color: "#b00" }}>
              {erro}
            </p>
          )}
          {carregando && <p className="register-hint">Carregando...</p>}
          {!carregando && buscou && sortedResultados.length === 0 && !erro && (
            <p className="register-hint">
              Nenhum resultado para a busca.
            </p>
          )}
          {!carregando && sortedResultados.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {sortedResultados.map((p) => {
                const { icon, alt } = resolvePacienteAvatar(p);
                return (
                  <li
                    key={p.id}
                    className="paciente-item"
                    onClick={() =>
                      navigate("/avaliacaopaciente", { state: { paciente: p } })
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate("/avaliacaopaciente", {
                          state: { paciente: p },
                        });
                      }
                    }}
                    style={{
                      background: "#fff",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      marginBottom: "8px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="paciente-info"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <img
                        src={icon}
                        alt={alt}
                        className="paciente-avatar"
                        style={{ width: 48, height: 48, borderRadius: "50%" }}
                      />
                      <div className="paciente-text">
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "#333",
                          }}
                        >
                          {p.nome} {p.sobrenome}
                        </div>
                        <div className="meta">ID: {p.id}</div>
                        <div className="meta">Ultima consulta: {ultimaConsultaCache[p.id] ?? "Carregando..."}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default NovaAvaliacao;


