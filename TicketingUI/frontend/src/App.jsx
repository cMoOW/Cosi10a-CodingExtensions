import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LoginPage from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import ViewTickets from "./components/ViewTickets.jsx";
import AuthPage from "./components/SignUp.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default page → Login */}
        <Route path="/" element={<AuthPage />} />

        {/* After login */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tickets" element={<ViewTickets />} />
      </Routes>
    </BrowserRouter>
  );
}

