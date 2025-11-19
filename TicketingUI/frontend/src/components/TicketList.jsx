// TicketList.jsx
// Displays all tickets in a table/card view with filtering

import React, { useState, useEffect } from 'react';
import { getTickets } from '../services/ticketService';
import TicketCard from './TicketCard';
import FilterBar from './FilterBar';
import './TicketList.css';

export default function TicketList({ onTicketSelect }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    assignedTo: '',
    priority: '',
    studentEmail: ''
  });

  // Fetch tickets when component mounts or filters change
  useEffect(() => {
    fetchTickets();
  }, [filters]);

  async function fetchTickets() {
    try {
      setLoading(true);
      setError(null);
      const data = await getTickets(filters);
      setTickets(data);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Failed to load tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  if (loading) {
    return (
      <div className="ticket-list-container">
        <div className="loading">Loading tickets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ticket-list-container">
        <div className="error">{error}</div>
        <button onClick={fetchTickets}>Retry</button>
      </div>
    );
  }

  return (
    <div className="ticket-list-container">
      <div className="ticket-list-header">
        <h2>Tickets ({tickets.length})</h2>
        <button onClick={fetchTickets} className="refresh-btn">Refresh</button>
      </div>

      <FilterBar filters={filters} onFilterChange={handleFilterChange} />

      {tickets.length === 0 ? (
        <div className="no-tickets">
          <p>No tickets found. {Object.values(filters).some(f => f) && 'Try adjusting your filters.'}</p>
        </div>
      ) : (
        <div className="ticket-grid">
          {tickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketSelect(ticket.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

