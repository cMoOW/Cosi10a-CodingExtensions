import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient"; // import the client
import { motion } from "framer-motion";
import { Clock, User, ArrowLeft } from "lucide-react";

export default function TicketsPage({ goToDashboard }) {
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");

  // Fetch tickets from Supabase
  // useEffect(() => {
  //   async function fetchTickets() {
  //     const { data, error } = await supabase.from("tickets").select("*");
  //     if (error) console.error("Error loading tickets:", error);
  //     else setTickets(data);
  //   }

  //   fetchTickets();
  // }, []);

  useEffect(() => {
    console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
    console.log("Supabase Client:", supabase);
  
    async function fetchTickets() {
      const { data, error } = await supabase.from("tickets").select("*");
      console.log({ data, error });
    }
  
    fetchTickets();
  }, []);
  

  // Filter by assignee name
  const filteredTickets = tickets.filter((t) =>
    t.assignee?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "24px", display: "grid", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold" }}>Tickets</h1>
        <button onClick={goToDashboard}>← Back</button>
      </div>

      <input
        placeholder="Search by assignee..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div style={{ display: "grid", gap: "20px" }}>
        {filteredTickets.map((ticket, i) => (
          <motion.div key={ticket.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3>{ticket.message}</h3>
            <p>{ticket.language}</p>
            <small>{ticket.status}</small>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
