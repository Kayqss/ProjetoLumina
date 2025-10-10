// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import NovaAvaliacao from "./pages/NovaAvaliacao";
import Login from "./pages/Login";
import AvaliacaoPaciente from "./pages/AvaliacaoPaciente";
import PerfilPaciente from "./pages/PerfilPaciente";
import MeusPacientes from "./pages/MeusPacientes";
import Compromissos from "./pages/Compromissos";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/avaliacao" element={<NovaAvaliacao />} />
        <Route path="/avaliacaopaciente" element={<AvaliacaoPaciente />} />
        <Route path="/perfilpaciente/:id" element={<PerfilPaciente />} />
        <Route path="/perfilpaciente" element={<Navigate to="/meuspacientes" replace />} />
        <Route path="/meuspacientes" element={<MeusPacientes />} />
        <Route path="/compromissos" element={<Compromissos />} />
        <Route path="/historico-geral" element={<Navigate to="/compromissos" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
