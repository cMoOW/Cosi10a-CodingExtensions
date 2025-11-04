import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";

export default function TicketTable() {
  const [search, setSearch] = useState("");
  const [tickets] = useState([
    { id: 1, title: "VSCode Sync Bug", status: "Open", priority: "High", assignedTo: "Apoorva" },
    { id: 2, title: "Add API Auth", status: "In Progress", priority: "Medium", assignedTo: "John" },
    { id: 3, title: "Login Page Fix", status: "Closed", priority: "Low", assignedTo: "Sarah" },
  ]);

  const filteredTickets = tickets.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition">
          <Plus size={18} /> New Ticket
        </button>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 max-w-md">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl shadow bg-white">
        <table className="min-w-full text-left border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Title</th>
              <th className="p-3">Status</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Assigned To</th>
            </tr>
          </thead>

          <tbody>
            {filteredTickets.map((ticket) => (
              <tr
                key={ticket.id}
                className="border-t hover:bg-gray-50 transition"
              >
                <td className="p-3">{ticket.id}</td>
                <td className="p-3">{ticket.title}</td>
                <td className="p-3">{ticket.status}</td>
                <td className="p-3">{ticket.priority}</td>
                <td className="p-3">{ticket.assignedTo}</td>
              </tr>
            ))}
            {filteredTickets.length === 0 && (
              <tr>
                <td colSpan="5" className="p-3 text-center text-gray-500">
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
