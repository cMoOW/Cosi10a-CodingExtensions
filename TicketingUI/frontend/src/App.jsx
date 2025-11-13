import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./components/Dashboard.jsx";
import ViewTickets from "./components/ViewTickets.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tickets" element={<ViewTickets />} />
      </Routes>
    </BrowserRouter>
  );
}


