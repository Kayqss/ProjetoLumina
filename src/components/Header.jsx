import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";
import logo from "../assets/icons/Logo.svg";
import FotoPerfil from "../assets/icons/FotoPerfil.svg";
import HomemIcon from "../assets/icons/HomemIcon.svg";
import MulherIcon from "../assets/icons/MulherIcon.svg";
import voltarIcon from "../assets/icons/Voltar.svg";

function Header({ mostrarMenu = true }) {
  const navigate = useNavigate();
  const [operatorInfo, setOperatorInfo] = useState({
    displayName: "Operador",
    fullName: "",
    email: "",
    gender: "",
    id: null,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef(null);
  const chipRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("lumina-operator");
      if (!raw) return;
      const data = JSON.parse(raw);

      const nome = typeof data?.nome === "string" ? data.nome.trim() : "";
      const sobrenome = typeof data?.sobrenome === "string" ? data.sobrenome.trim() : "";
      const fullName = [nome, sobrenome].filter(Boolean).join(" ").trim();

      let displayName = "";
      if (fullName) {
        const first = fullName.split(/\s+/)[0];
        if (first) displayName = first;
      }
      if (!displayName && typeof data?.email === "string" && data.email.trim()) {
        displayName = data.email.trim();
      }

      const genderCandidates = [
        data?.genero,
        data?.gender,
        data?.profile?.genero,
        data?.profile?.gender,
      ];
      const rawGender = genderCandidates.find(
        (value) => typeof value === "string" && value.trim().length > 0
      );
      const normalizedGender = rawGender ? rawGender.trim().toLowerCase() : "";

      const idCandidates = [
        data?.id,
        data?.operatorId,
        data?.operatorID,
        data?.profile?.id,
        data?.profile?.operatorId,
      ];
      const operatorId = idCandidates
        .map((value) => {
          const numeric = Number(value);
          return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
        })
        .find((value) => value !== null);

      const email =
        typeof data?.email === "string" && data.email.trim() ? data.email.trim() : displayName;

      setOperatorInfo((prev) => ({
        ...prev,
        displayName: displayName || prev.displayName,
        fullName: fullName || displayName || prev.fullName,
        email,
        gender: normalizedGender,
        id: operatorId ?? null,
      }));
    } catch {
      // Ignore parsing errors silently
    }
  }, []);

  const { icon: avatarIcon, alt: avatarAlt } = useMemo(() => {
    const normalized = typeof operatorInfo.gender === "string" ? operatorInfo.gender : "";
    const isFemale =
      normalized.startsWith("f") || normalized.includes("mulher") || normalized.includes("female");
    const isMale =
      normalized.startsWith("m") || normalized.includes("homem") || normalized.includes("male");

    if (isFemale) {
      return { icon: MulherIcon, alt: "Foto da operadora" };
    }
    if (isMale) {
      return { icon: HomemIcon, alt: "Foto do operador" };
    }
    return { icon: FotoPerfil, alt: "Foto do operador" };
  }, [operatorInfo.gender]);

  const genderLabel = useMemo(() => {
    const value = (operatorInfo.gender || "").trim().toLowerCase();
    if (!value) return "";
    if (value === "f" || value.startsWith("fem") || value.includes("mulher")) return "Feminino";
    if (value === "m" || value.startsWith("masc") || value.includes("homem")) return "Masculino";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }, [operatorInfo.gender]);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event) => {
      if (!menuContainerRef.current) return;
      if (
        !menuContainerRef.current.contains(event.target) &&
        !chipRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  const handleToggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleChipKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggleMenu();
    }
    if (event.key === "Escape") {
      closeMenu();
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("lumina-operator");
    }
    closeMenu();
    navigate("/login");
  };

  const displayName = operatorInfo.displayName || "Operador";

  return (
    <header className="header">
      <div className="header-left">
        {!mostrarMenu ? (
          <button
            className="botao-redondo"
            onClick={() => navigate("/home")}
            aria-label="Voltar para a pagina inicial"
          >
            <img src={voltarIcon} alt="Voltar" className="icone-padrao" />
          </button>
        ) : null}
      </div>

      <div className="logo-container">
        <img src={logo} alt="Logo LuminaAI" className="logo" />
      </div>

      <div className="header-right" ref={menuContainerRef}>
        <div
          className="operator-chip"
          onClick={handleToggleMenu}
          role="button"
          tabIndex={0}
          ref={chipRef}
          onKeyDown={handleChipKeyDown}
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
        >
          <span className="operator-chip__avatar">
            <img src={avatarIcon} alt={avatarAlt} />
          </span>
          <span className="operator-chip__text">
            <span className="operator-chip__name">{displayName}</span>
            <span className="operator-chip__role">operador</span>
          </span>
        </div>

        {isMenuOpen ? (
          <div className="operator-menu" role="dialog" aria-label="Detalhes do operador">
            <div className="operator-menu__item">
              <span className="operator-menu__label">Operador:</span>
              <span className="operator-menu__value">
                {operatorInfo.fullName || operatorInfo.displayName}
              </span>
            </div>
            <div className="operator-menu__item">
              <span className="operator-menu__label">ID do operador:</span>
              <span className="operator-menu__value">
                {operatorInfo.id != null ? operatorInfo.id : "Não disponível"}
              </span>
            </div>
            <div className="operator-menu__item">
              <span className="operator-menu__label">Gênero:</span>
              <span className="operator-menu__value">{genderLabel || "Não informado"}</span>
            </div>
            <div className="operator-menu__item">
              <span className="operator-menu__label">E-mail do operador:</span>
              <span className="operator-menu__value">
                {operatorInfo.email || "Não informado"}
              </span>
            </div>
            <button type="button" className="operator-menu__logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default Header;
