import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // import necessario
import "./Login.css";
import Logo from "../assets/icons/Logo.svg";

function Login() {
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    nome: "",
    sobrenome: "",
    email: "",
    senha: "",
    genero: "",
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginInfo, setLoginInfo] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const handleRegisterChange = (field) => (event) => {
    const value = event?.target?.value ?? "";
    setRegisterForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCriarConta = () => {
    setRegisterError("");
    setLoginError("");
    setLoginInfo("");
    setIsCreatingAccount(true);
  };

  const handleVoltarLogin = () => {
    setRegisterError("");
    setLoginError("");
    setIsCreatingAccount(false);
  };

  const handleRegistrarConta = async () => {
    setRegisterError("");
    setLoginInfo("");

    const nome = registerForm.nome.trim();
    const sobrenome = registerForm.sobrenome.trim();
    const email = registerForm.email.trim().toLowerCase();
    const genero = registerForm.genero;
    const senha = registerForm.senha;

    if (!nome || !sobrenome || !email || !genero || !senha) {
      setRegisterError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setRegisterError("E-mail inválido.");
      return;
    }

    if (senha.length < 8) {
      setRegisterError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    try {
      setRegisterLoading(true);
      const res = await fetch(`${baseUrl}/operators/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ nome, sobrenome, email, genero, senha }),
      });

      if (!res.ok) {
        let message = "Não foi possível registrar a conta.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse issues
        }
        setRegisterError(message);
        return;
      }

      setRegisterForm({
        nome: "",
        sobrenome: "",
        email: "",
        senha: "",
        genero: "",
      });
      setIsCreatingAccount(false);
      setLoginEmail(email);
      setLoginPassword("");
      setLoginInfo(
        "Conta criada com sucesso! Faça login com suas credenciais."
      );
    } catch (error) {
      console.error("Erro ao registrar conta de operador.", error);
      setRegisterError("Erro inesperado ao registrar a conta.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginError("");
    setLoginInfo("");

    const email = loginEmail.trim().toLowerCase();
    const senha = loginPassword;

    if (!email || !senha) {
      setLoginError("Informe email e senha.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setLoginError("E-mail invalido.");
      return;
    }

    try {
      setLoginLoading(true);
      const res = await fetch(`${baseUrl}/operators/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ email, senha }),
      });

      if (!res.ok) {
        let message = "Nao foi possivel efetuar login.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse issues
        }
        setLoginError(message);
        return;
      }

      const profile = await res.json();
      if (typeof window !== "undefined") {
        try {
          const payload = {
            id: profile?.id ?? null,
            nome: typeof profile?.nome === "string" ? profile.nome : "",
            sobrenome:
              typeof profile?.sobrenome === "string" ? profile.sobrenome : "",
            email: typeof profile?.email === "string" ? profile.email : email,
            genero: typeof profile?.genero === "string" ? profile.genero : "",
            createdAt: profile?.createdAt ?? null,
          };
          window.localStorage.setItem(
            "lumina-operator",
            JSON.stringify(payload)
          );
        } catch {
          // ignore storage errors
        }
      }
      setLoginEmail(profile?.email ?? email);
      setLoginPassword("");
      setLoginError("");
      navigate("/home");
    } catch (error) {
      console.error("Erro ao efetuar login de operador.", error);
      setLoginError("Erro inesperado ao efetuar login.");
    } finally {
      setLoginLoading(false);
    }
  };

  const isLoginDisabled = loginLoading || !loginEmail.trim() || !loginPassword;

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={Logo} alt="Logo do Projeto" className="login-logo" />

        <h4>{isCreatingAccount ? "Criar conta" : "Login"}</h4>
        <p>
          {isCreatingAccount
            ? "Informe seus dados para criar sua conta."
            : "Seja bem vindo. Utilize com sabedoria."}
        </p>

        {isCreatingAccount ? (
          <>
            {registerError ? (
              <p className="login-feedback error" role="alert">
                {registerError}
              </p>
            ) : null}

            <select
              className="login-input"
              value={registerForm.genero}
              onChange={handleRegisterChange("genero")}
            >
              <option value="">Selecione o gênero</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
            <input
              type="text"
              placeholder="Nome"
              className="login-input"
              value={registerForm.nome}
              onChange={handleRegisterChange("nome")}
              autoComplete="given-name"
            />
            <input
              type="text"
              placeholder="Sobrenome"
              className="login-input"
              value={registerForm.sobrenome}
              onChange={handleRegisterChange("sobrenome")}
              autoComplete="family-name"
            />
            <input
              type="email"
              placeholder="E-mail"
              className="login-input"
              value={registerForm.email}
              onChange={handleRegisterChange("email")}
              autoComplete="email"
            />
            <div className="password-container">
              <input
                type="password"
                placeholder="Senha"
                className="login-input"
                value={registerForm.senha}
                onChange={handleRegisterChange("senha")}
                autoComplete="new-password"
              />
            </div>
            <button
              className="login-button"
              onClick={handleRegistrarConta}
              disabled={registerLoading}
            >
              {registerLoading ? "Registrando..." : "Registrar conta"}
            </button>
            <p className="cadastro-convite">
              J&#225; tem uma conta?{" "}
              <span className="clique-aqui" onClick={handleVoltarLogin}>
                Fa&#231;a login.
              </span>
            </p>
          </>
        ) : (
          <>
            {loginError ? (
              <p className="login-feedback error" role="alert">
                {loginError}
              </p>
            ) : null}
            {loginInfo ? (
              <p className="login-feedback success" role="status">
                {loginInfo}
              </p>
            ) : null}

            <input
              type="email"
              placeholder="E-mail"
              className="login-input"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              autoComplete="email"
            />
            <div className="password-container">
              <input
                type="password"
                placeholder="Senha"
                className="login-input"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button
              className="login-button"
              onClick={handleLogin}
              disabled={isLoginDisabled}
            >
              {loginLoading ? "Entrando..." : "Entrar"}
            </button>
            <p className="cadastro-convite">
              N&#227;o tem uma conta?{" "}
              <span className="clique-aqui" onClick={handleCriarConta}>
                Crie uma.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
