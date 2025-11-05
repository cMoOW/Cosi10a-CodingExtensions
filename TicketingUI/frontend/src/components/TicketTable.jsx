import React, { useState } from "react";
import { motion } from "framer-motion";
import { Clock, User, ArrowLeft } from "lucide-react";

export default function TicketsPage({ goToDashboard }) {
  const [search, setSearch] = useState(""); // state for search input

  const tickets = [
    {
      id: 1,
      title: "Login not working",
      description: "User unable to log in with correct credentials.",
      status: "Open",
      assignee: "Apoorva",
    },
    {
      id: 2,
      title: "Slow API response",
      description: "Requests to /tickets take over 5 seconds.",
      status: "In Progress",
      assignee: "Apoorva",
    },
    {
      id: 3,
      title: "UI bug on mobile",
      description: "Buttons overlap on small screens.",
      status: "Resolved",
      assignee: "Apoorva",
    },
    {
      id: 4,
      title: "Signup error",
      description: "New users cannot register",
      status: "Open",
      assignee: "Random",
    },
  ];

  // Filter tickets based on assignee search
  const filteredTickets = tickets.filter((ticket) =>
    ticket.assignee.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "24px", display: "grid", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold" }}>Tickets</h1>
        <button
          onClick={goToDashboard}
          style={{
            borderRadius: "16px",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={20} /> Back to Dashboard
        </button>
      </div>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search by assignee..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "10px 16px",
          borderRadius: "12px",
          border: "1px solid #ccc",
          width: "250px",
          fontSize: "14px",
        }}
      />

      {/* Tickets Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        {filteredTickets.length > 0 ? (
          filteredTickets.map((ticket, index) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{
                borderRadius: "16px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                background: "white",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "150px",
              }}
            >
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "6px" }}>
                  {ticket.title}
                </h2>
                <p style={{ color: "#666", fontSize: "14px", marginBottom: "12px" }}>
                  {ticket.description}
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: "#555",
                  fontSize: "14px",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={16} /> {ticket.status}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <User size={16} /> {ticket.assignee}
                </span>
              </div>
            </motion.div>
          ))
        ) : (
          <p>No tickets found for "{search}"</p>
        )}
      </div>
    </div>
  );
}
