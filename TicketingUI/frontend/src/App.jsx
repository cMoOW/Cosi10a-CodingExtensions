import { useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import TicketTable from "./components/TicketTable.jsx";

export default function App() {
  const [page, setPage] = useState("dashboard");

  return (
    <>
      {page === "dashboard" && <Dashboard goToTickets={() => setPage("tickets")} />}
      {page === "tickets" && <TicketTable />}
    </>
  );
}
