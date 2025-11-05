import React, { useState } from "react";
import Dashboard from "./pages/Dashboard";
import TicketsPage from "./components/TicketTable";

export default function App() {
  const [page, setPage] = useState("dashboard");

  const tickets = [
    { id: 1, title: "Login not working", status: "Open", assignee: "Apoorva" },
    { id: 2, title: "Slow API response", status: "In Progress", assignee: "Apoorva" },
    { id: 3, title: "UI bug on mobile", status: "Resolved", assignee: "Apoorva" },
    {
      id: 4,
      title: "Signup error",
      description: "New users cannot register",
      status: "Open",
      assignee: "Random",
    }
  ];

  return page === "dashboard" ? (
    <Dashboard goToTickets={() => setPage("tickets")} tickets={tickets} />
  ) : (
    <TicketsPage goToDashboard={() => setPage("dashboard")} tickets={tickets} />
  );
}
