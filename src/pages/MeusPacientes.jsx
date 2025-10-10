import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import HomemIcon from "../assets/icons/HomemIcon.svg";
import MulherIcon from "../assets/icons/MulherIcon.svg";
import "./MeusPacientes.css";
import { fetchWithOperator } from "../utils/operator";

function MeusPacientes() {
  const navigate = useNavigate();
  const getPacienteAvatar = (paciente) => {
    const candidates = [
      paciente?.genero,
      paciente?.gender,
      paciente?.sexo,
      paciente?.sex,
      paciente?.dadosBasicos?.genero,
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
  };

  const [mostrarNovo, setMostrarNovo] = useState(false);

  // estados para busca
  const [buscaNome, setBuscaNome] = useState("");
  const [buscaId, setBuscaId] = useState("");
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroBusca, setErroBusca] = useState("");
  const [searchAtivo, setSearchAtivo] = useState(false);
  const [order, setOrder] = useState("id_desc"); // az | za | id_desc | id_asc
  const [showOrderMenu, setShowOrderMenu] = useState(false);
  // sugestões (typeahead)
  const [sugestoes, setSugestoes] = useState([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);
  const [openSugestoes, setOpenSugestoes] = useState(false);

  // lista paginada (infinite scroll)
  const [pacientes, setPacientes] = useState([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const LIMIT = 10;
  const loaderRef = useRef(null);
  const didInit = useRef(false);
  const loadingRef = useRef(false); // evita requisições concorrentes

  const [ultimaConsultaCache, setUltimaConsultaCache] = useState({});
  const ultimaConsultaCacheRef = useRef({});

  useEffect(() => {
    ultimaConsultaCacheRef.current = ultimaConsultaCache;
  }, [ultimaConsultaCache]);


  // estados para "Novo paciente"
  const [genero, setGenero] = useState("");
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [telefonesList, setTelefonesList] = useState([]);
  const [nascimentoDia, setNascimentoDia] = useState("");
  const [nascimentoMes, setNascimentoMes] = useState("");
  const [nascimentoAno, setNascimentoAno] = useState("");

  const [historicoClinico, setHistoricoClinico] = useState("");
  const [medicacoes, setMedicacoes] = useState("");
  const [alergias, setAlergias] = useState("");

  // Ordenação em memória para refletir imediatamente na UI
  const sortPatients = (arr, ord) => {
    const byIdAsc = (a, b) => (a.id ?? 0) - (b.id ?? 0);
    const byIdDesc = (a, b) => (b.id ?? 0) - (a.id ?? 0);
    const normalize = (s) =>
      String(s || "")
        .normalize?.("NFD")
        .replace(/\p{Diacritic}/gu, "")
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

  // Formatar data (YYYY-MM-DD ou ISO) para DD/MM/AAAA
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
      
  const sortedResultados = useMemo(
    () => sortPatients(resultados, order),
    [resultados, order]
  );
  const sortedPacientes = useMemo(
    () => sortPatients(pacientes, order),
    [pacientes, order]
  );

  // Buscar pacientes por nome ou id
  const handleBuscar = async () => {
    try {
      setErroBusca("");
      setCarregando(true);
      setResultados([]);
      setSearchAtivo(true);

      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const id = Number(buscaId);

      if (buscaId && Number.isFinite(id)) {
        const res = await fetchWithOperator(`${baseUrl}/patients/${id}`);
        if (res.status === 404) {
          setResultados([]);
        } else if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Falha ${res.status}`);
        } else {
          const p = await res.json();
          setResultados(p ? [p] : []);
        }
      } else if (buscaNome) {
        const url = new URL(`${baseUrl}/patients`);
        url.searchParams.set("name", buscaNome);
        if (order) url.searchParams.set("order", order);
        const res = await fetchWithOperator(url);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Falha ${res.status}`);
        }
        const list = await res.json();
        setResultados(Array.isArray(list) ? list : []);
      } else {
        setErroBusca("Informe o nome ou o ID do paciente para buscar.");
      }
    } catch (e) {
      console.error(e);
      setErroBusca("Erro ao buscar pacientes.");
    } finally {
      setCarregando(false);
    }
  };

  const limparBusca = () => {
    setBuscaNome("");
    setBuscaId("");
    setResultados([]);
    setErroBusca("");
    setCarregando(false);
    setSearchAtivo(false);
  };

  // carregamento inicial e paginação
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  useEffect(() => {
    const ids = new Set();
    for (const list of [sortedResultados, sortedPacientes]) {
      if (!Array.isArray(list)) continue;
      for (const paciente of list) {
        const id = Number(paciente?.id);
        if (Number.isFinite(id)) ids.add(id);
      }
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
              let value = "sem registro";
              if (Array.isArray(items) && items.length > 0) {
                const latest = items
                  .slice()
                  .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))[0];
                const formatted = formatDate(latest?.createdAt);
                if (formatted) value = formatted;
              }
              return { id, value };
            } catch (error) {
              console.error('Falha ao carregar ultima consulta do paciente', id, error);
              return { id, value: "sem registro" };
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
        console.error('Erro ao buscar ultimas consultas.', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sortedResultados, sortedPacientes, baseUrl]);

  const fetchPage = async (pageSkip) => {
    const url = new URL(`${baseUrl}/patients`);
    url.searchParams.set("take", String(LIMIT));
    url.searchParams.set("skip", String(pageSkip));
    if (order) url.searchParams.set("order", order);
    const res = await fetchWithOperator(url);
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };

  const carregarMais = async () => {
    if (loadingRef.current || carregandoLista || !hasMore) return;
    loadingRef.current = true;
    setCarregandoLista(true);
    try {
      const list = await fetchPage(skip);
      setPacientes((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        for (const p of Array.isArray(list) ? list : []) {
          if (!byId.has(p.id)) byId.set(p.id, p);
        }
        return Array.from(byId.values());
      });
      setSkip((prev) => prev + (Array.isArray(list) ? list.length : 0));
      if (!Array.isArray(list) || list.length < LIMIT) setHasMore(false);
    } catch (e) {
      console.error(e);
      setHasMore(false);
    } finally {
      setCarregandoLista(false);
      loadingRef.current = false;
    }
  };

  const recarregarLista = async () => {
    setPacientes([]);
    setHasMore(true);
    loadingRef.current = true;
    setCarregandoLista(true);
    try {
      const firstPage = await fetchPage(0);
      setPacientes(Array.isArray(firstPage) ? firstPage : []);
      setSkip(Array.isArray(firstPage) ? firstPage.length : 0);
      if (!Array.isArray(firstPage) || firstPage.length < LIMIT)
        setHasMore(false);
    } catch (e) {
      console.error(e);
      setHasMore(false);
    } finally {
      setCarregandoLista(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    // primeira carga (evita duplicar no StrictMode)
    if (didInit.current) return;
    didInit.current = true;
    recarregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Observer para infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const el = loaderRef.current;
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && !searchAtivo && !mostrarNovo) {
        carregarMais();
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchAtivo, mostrarNovo]);

  // Reaplica ordenação ao mudar o filtro
  useEffect(() => {
    const hasQuery =
      (buscaNome && buscaNome.trim().length > 0) ||
      (buscaId && String(buscaId).trim().length > 0);
    if (searchAtivo) {
      if (hasQuery) {
        // reexecuta a busca atual com nova ordenação
        handleBuscar();
      } else {
        // se estava em modo busca mas sem filtros válidos, volta para a lista infinita
        setSearchAtivo(false);
        recarregarLista();
      }
    } else {
      recarregarLista();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  // Buscar sugestões conforme digita o nome (debounce)

  const handleRegistrar = async () => {
    try {
      // basic validation
      if (
        !genero ||
        !nome ||
        !sobrenome ||
        !cpf ||
        !nascimentoDia ||
        !nascimentoMes ||
        !nascimentoAno
      ) {
        alert("Preencha gênero, nome, sobrenome, CPF e data de nascimento.");
        return;
      }

      // CPF: 11 dígitos numéricos
          if (!/^\d{11}$/.test(cpf)) {
        alert("CPF deve conter exatamente 11 dígitos numéricos.");
        return;
      }

      // Dia: 1 a 31
      const diaNum = parseInt(nascimentoDia, 10);
      if (!Number.isFinite(diaNum) || diaNum < 1 || diaNum > 31) {
        alert("Data de nascimento inconsistente.");
        return;
      }

      // Ano: 4 dígitos
      if (!/^\d{4}$/.test(nascimentoAno)) {
        alert("Ano de nascimento deve conter 4 dígitos.");
        return;
      }

          const nasc = `${nascimentoAno}-${nascimentoMes}-${nascimentoDia}`;
          const cpfDigits = String(cpf || "").replace(/\D/g, "");
      const phones = [];
      const telDigits = String(telefone || "").replace(/\D/g, "");
      if (telDigits.length > 0) phones.push(telefone);
      for (const t of telefonesList) {
        if (t && !phones.includes(t)) phones.push(t);
      }
          const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
          const hojeISO = new Date().toISOString().split("T")[0];
          const payload = {
            genero,
            nome,
            sobrenome,
            cpf,
            telefone: phones[0] || "",
            telefones: phones,
            nascimento: nasc,
            primeiraConsulta: hojeISO,
            historicoClinico,
            medicacoes,
            alergias,
          };

          const res = await fetchWithOperator(`${baseUrl}/patients`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao registrar: ${err.error || res.status}`);
        return;
      }

      const p = await res.json();
      try {
        const phonesKey = `phones:${p?.id ?? ''}`;
        if (p?.id != null) {
          const phonesToStore = Array.isArray(phones) ? phones : [];
          localStorage.setItem(phonesKey, JSON.stringify(phonesToStore));
        }
      } catch {}
      console.log("Paciente criado:", p);
      alert("Paciente registrado com sucesso!");

      // reset form
      setGenero("");
      setNome("");
      setSobrenome("");
      setCpf("");
      setTelefone("");
      setTelefonesList([]);
      setNascimentoDia("");
      setNascimentoMes("");
      setNascimentoAno("");
      setHistoricoClinico("");
      setMedicacoes("");
      setAlergias("");
      setMostrarNovo(false);
      setSearchAtivo(false);
      await recarregarLista();
    } catch (e) {
      console.error(e);
      alert("Falha de conexão com o servidor.");
    }
  };

  return (
    <div className="page-background">
      <Header mostrarMenu={false} />
      <main className="meus-pacientes-container">
        <h1 className="meus-pacientes-title">Meus Pacientes</h1>
        <p className="meus-pacientes-desc">
          Pesquise por um paciente existente ou cadastre um novo.
        </p>

        {/* Linha com nome, ID e botão ao lado */}
        <div className="form-container">
          <div className="inline-inputs">
            <input
              type="text"
              placeholder="Nome do paciente"
              className="form-input nome-input"
              aria-label="Nome do paciente"
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
              disabled={mostrarNovo}
            />
            <input
              type="text"
              placeholder="ID do paciente"
              className="form-input id-input"
              aria-label="ID do paciente"
              value={buscaId}
              onChange={(e) => setBuscaId(e.target.value)}
              disabled={mostrarNovo}
            />
            {!mostrarNovo && (
              <button
                className="toggle-btn"
                onClick={handleBuscar}
                aria-label="Buscar pacientes"
              >
                Buscar
              </button>
            )}
            {!mostrarNovo && (
              <div style={{ position: "relative" }}>
                <button
                  className="toggle-btn"
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
                      minWidth: 160,
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
                      A–Z (alfabética)
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
                      Z–A (alfabética inversa)
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
            )}
            {!mostrarNovo && searchAtivo && (
              <button
                className="toggle-btn cancel-btn"
                onClick={limparBusca}
                aria-label="Limpar busca"
              >
                Limpar
              </button>
            )}
            {/* Spacer empurra o botão de novo paciente para a direita */}
            <div style={{ flex: 1 }} />
            <button
              className={`toggle-btn ${mostrarNovo ? "cancel-btn" : ""}`}
              onClick={() => setMostrarNovo((v) => !v)}
              aria-expanded={mostrarNovo}
              aria-controls="novo-paciente-form"
            >
              {mostrarNovo ? "Cancelar" : "+ Novo paciente"}
            </button>
          </div>
        </div>

        {/* Linha divisória SEMPRE visível */}
        <hr className="divider" />

        {/* Resultados da busca OU lista infinita */}
        {!mostrarNovo && (
          <div className="form-container">
            {searchAtivo ? (
              <>
                {erroBusca && (
                  <p className="register-hint" style={{ color: "#b00" }}>
                    {erroBusca}
                  </p>
                )}
                {carregando ? (
                  <p className="register-hint">Carregando...</p>
                ) : resultados.length > 0 ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {sortedResultados.map((p) => {
                    const { icon, alt } = getPacienteAvatar(p);
                    return (
                      <li
                        key={p.id}
                        className="paciente-item"
                        tabIndex={0}
                        onClick={() => {
                          try {
                            const key = `phones:${p?.id ?? ''}`;
                            const arr = JSON.parse(localStorage.getItem(key) || '[]');
                            const phones = Array.isArray(arr) ? arr : [];
                            const enriched = { ...p };
                            if (phones.length > 0) {
                              enriched.telefones = phones;
                              if (!enriched.telefone) enriched.telefone = phones[0];
                            }
                            navigate(`/perfilpaciente/${p.id}` , { state: { paciente: enriched } });
                          } catch {
                            navigate(`/perfilpaciente/${p.id}` , { state: { paciente: p } });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            try {
                              const key = `phones:${p?.id ?? ''}`;
                              const arr = JSON.parse(localStorage.getItem(key) || '[]');
                              const phones = Array.isArray(arr) ? arr : [];
                              const enriched = { ...p };
                              if (phones.length > 0) {
                                enriched.telefones = phones;
                                if (!enriched.telefone) enriched.telefone = phones[0];
                              }
                              navigate(`/perfilpaciente/${p.id}` , { state: { paciente: enriched } });
                            } catch {
                              navigate(`/perfilpaciente/${p.id}` , { state: { paciente: p } });
                            }
                          }
                        }}
                        style={{
                          background: "#fff",
                          borderRadius: "8px",
                          padding: "12px 16px",
                          marginBottom: "8px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}
                      >
                        <div className="paciente-info">
                          <img
                            src={icon}
                            alt={alt}
                            className="paciente-avatar"
                          />
                          <div className="paciente-text">
                            <div
                              style={{
                                fontSize: "16px",
                                color: "#333",
                                fontWeight: "bold",
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
                ) : (
                  <p className="register-hint">
                    Nenhum resultado para a busca.
                  </p>
                )}
              </>
            ) : (
              <>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {sortedPacientes.map((p) => {
                    const { icon, alt } = getPacienteAvatar(p);
                    return (
                      <li
                        key={p.id}
                        className="paciente-item"
                        tabIndex={0}
                        onClick={() => {
                          try {
                            const key = `phones:${p?.id ?? ''}`;
                            const arr = JSON.parse(localStorage.getItem(key) || '[]');
                            const phones = Array.isArray(arr) ? arr : [];
                            const enriched = { ...p };
                            if (phones.length > 0) {
                              enriched.telefones = phones;
                              if (!enriched.telefone) enriched.telefone = phones[0];
                            }
                            navigate(`/perfilpaciente/${p.id}` , { state: { paciente: enriched } });
                          } catch {
                            navigate(`/perfilpaciente/${p.id}` , { state: { paciente: p } });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            try {
                              const key = `phones:${p?.id ?? ''}`;
                              const arr = JSON.parse(localStorage.getItem(key) || '[]');
                              const phones = Array.isArray(arr) ? arr : [];
                              const enriched = { ...p };
                              if (phones.length > 0) {
                                enriched.telefones = phones;
                                if (!enriched.telefone) enriched.telefone = phones[0];
                              }
                              navigate(`/perfilpaciente/${p.id}` , { state: { paciente: enriched } });
                            } catch {
                              navigate(`/perfilpaciente/${p.id}` , { state: { paciente: p } });
                            }
                          }
                        }}
                      >
                        <div className="paciente-info">
                          <img
                            src={icon}
                            alt={alt}
                            className="paciente-avatar"
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
                              <div className="meta">Última consulta: {ultimaConsultaCache[p.id] ?? "Carregando..."}</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}

                </ul>
                <div
                  ref={loaderRef}
                  style={{ textAlign: "center", padding: "8px", color: "#666" }}
                >
                  {carregandoLista
                    ? "Carregando..."
                    : hasMore
                    ? "Desça para carregar mais"
                    : "Todos os pacientes foram carregados"}
                </div>
              </>
            )}
          </div>
        )}

        {mostrarNovo && (
          <div className="form-container" id="novo-paciente-form">
            <p className="register-hint">
              Primeira etapa de registro, insira todos os dados básicos do
              paciente.
            </p>

            <select
              className="gender-select"
              value={genero}
              onChange={(e) => setGenero(e.target.value)}
              aria-label="Gênero"
            >
              <option value="">Selecione o gênero*</option>
              <option value="Masculino">Homem</option>
              <option value="Feminino">Mulher</option>
            </select>

            <input
              type="text"
              placeholder="Nome*"
              className="form-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              aria-label="Nome"
            />
            <input
              type="text"
              placeholder="Sobrenome*"
              className="form-input"
              value={sobrenome}
              onChange={(e) => setSobrenome(e.target.value)}
              aria-label="Sobrenome"
            />
            <input
              type="text"
              placeholder="CPF*"
              className="form-input"
              value={cpf}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                setCpf(digits);
              }}
              inputMode="numeric"
              aria-label="CPF"
            />

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", maxWidth: 565 }}>
              <input
                type="text"
                placeholder="Telefone"
                className="form-input"
                style={{ flex: 1 }}
                value={telefone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  const ddd = digits.slice(0, 2);
                  const rest = digits.slice(2);
                  const formatted = (ddd ? `(${ddd}${ddd.length === 2 ? ") " : ""}` : "") + rest;
                  setTelefone(formatted);
                }}
                inputMode="numeric"
                aria-label="Telefone"
              />
              <button
                type="button"
                aria-label="Adicionar telefone"
                onClick={() => {
                  const clean = String(telefone || "").trim();
                  const digits = clean.replace(/\D/g, "");
                  if (!clean || digits.length === 0) return;
                  setTelefonesList((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
                  setTelefone("");
                }}
                style={{
                  padding: "0.9rem 1.1rem",
                  borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  background: "#246afe",
                  color: "#fff",
                  boxShadow: "0px 0px 5px #246afe5a",
                  cursor: "pointer",
                }}
              >
                +
              </button>
            </div>
            {telefonesList.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", maxWidth: 565 }}>
                {telefonesList.map((t) => (
                  <span
                    key={t}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.4rem 0.6rem",
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(0,0,0,0.1)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      fontSize: "0.95rem",
                    }}
                  >
                    {t}
                    <button
                      type="button"
                      aria-label={`Remover ${t}`}
                      onClick={() => setTelefonesList((prev) => prev.filter((x) => x !== t))}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#888",
                        cursor: "pointer",
                        fontSize: "1rem",
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="birth-date-group">
              <label className="birth-label">Data de nascimento*</label>
              <input
                type="text"
                placeholder="Dia"
                className="birth-input"
                value={nascimentoDia}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                  setNascimentoDia(digits);
                }}
                inputMode="numeric"
                aria-label="Dia de nascimento"
              />
              <select
                className="birth-input"
                value={nascimentoMes}
                onChange={(e) => setNascimentoMes(e.target.value)}
                aria-label="Mês de nascimento"
              >
                <option value="">Mês</option>
                <option value="01">Janeiro</option>
                <option value="02">Fevereiro</option>
                <option value="03">Março</option>
                <option value="04">Abril</option>
                <option value="05">Maio</option>
                <option value="06">Junho</option>
                <option value="07">Julho</option>
                <option value="08">Agosto</option>
                <option value="09">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
              <input
                type="text"
                placeholder="Ano"
                className="birth-input"
                value={nascimentoAno}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setNascimentoAno(digits);
                }}
                inputMode="numeric"
                aria-label="Ano de nascimento"
              />
            </div>

            <p className="register-hint">
              Dados básicos adicionais (se necessário, separe por vírgula).
            </p>

            <input
              type="text"
              placeholder="Histórico clínico"
              className="form-input"
              value={historicoClinico}
              onChange={(e) => setHistoricoClinico(e.target.value)}
              aria-label="Histórico clínico"
            />
            <input
              type="text"
              placeholder="Medicações em uso"
              className="form-input"
              value={medicacoes}
              onChange={(e) => setMedicacoes(e.target.value)}
              aria-label="Medicações em uso"
            />
            <input
              type="text"
              placeholder="Alergias ou intolerâncias alimentares"
              className="form-input"
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              aria-label="Alergias ou intolerâncias alimentares"
            />

            <button className="register-btn" onClick={handleRegistrar}>
              Registrar paciente
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default MeusPacientes;
