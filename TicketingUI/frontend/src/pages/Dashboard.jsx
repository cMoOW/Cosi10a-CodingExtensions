import React from "react";
import { Ticket, BarChart2, Users } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard({ goToTickets, tickets }) {
  // Compute stats dynamically
  const totalTickets = tickets.length;
  const openTickets = tickets.filter((t) => t.status === "Open").length;
  const usersCount = [...new Set(tickets.map((t) => t.assignee))].length;

  // Cards to display
  const stats = [
    { label: "Total Tickets", value: totalTickets, icon: Ticket },
    { label: "Open Tickets", value: openTickets, icon: BarChart2 },
    { label: "Users", value: usersCount, icon: Users },
  ];

  return (
    <div style={{ padding: "24px", display: "grid", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "bold" }}>Ticket Dashboard</h1>
        <button
          onClick={goToTickets}
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
          <Ticket size={20} /> View Tickets
        </button>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        {stats.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{
              borderRadius: "16px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              background: "white",
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p style={{ color: "#666", fontSize: "14px" }}>{item.label}</p>
              <h2 style={{ fontSize: "24px", fontWeight: "600" }}>{item.value}</h2>
            </div>
            <item.icon size={32} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
