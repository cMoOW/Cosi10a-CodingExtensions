// TicketList.jsx
// Displays all tickets in a table/card view with filtering

import React, { useState, useEffect } from 'react';
import { getTickets } from '../services/ticketService';
import TicketCard from './TicketCard';
import FilterBar from './FilterBar';
import './TicketList.css';

export default function TicketList({ onTicketSelect }) {
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [filters, setFilters] = useState({
    status: 'open', // Default to showing only open tickets
    assignedTo: '',
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
      // Fetch tickets but don't filter by status if we want to handle resolved filtering separately
      const fetchFilters = { ...filters };
      // If status filter is set, use it; otherwise we'll filter resolved in the component
      const data = await getTickets(fetchFilters);
      setAllTickets(data);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('Failed to load tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = (newFilters) => {
    // If status is being changed, update showResolved state accordingly
    if (newFilters.hasOwnProperty('status')) {
      setShowResolved(newFilters.status === 'resolved');
    }
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Filter tickets based on status filter
  const tickets = allTickets.filter(ticket => {
    // Use the status filter (defaults to 'open')
    if (filters.status) {
      return ticket.status === filters.status;
    }
    // Fallback to open tickets if no status filter
    return ticket.status === 'open';
  });

  // Handle resolved view toggle
  const handleResolvedToggle = (checked) => {
    setShowResolved(checked);
    if (checked) {
      // Show resolved tickets
      setFilters(prev => ({ ...prev, status: 'resolved' }));
    } else {
      // Show open tickets
      setFilters(prev => ({ ...prev, status: 'open' }));
    }
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
        <h2>{showResolved ? 'Resolved Tickets' : 'Open Tickets'} ({tickets.length})</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => handleResolvedToggle(e.target.checked)}
            />
            <span style={{ fontSize: '14px' }}>Show Resolved Tickets</span>
          </label>
          <button onClick={fetchTickets} className="refresh-btn">Refresh</button>
        </div>
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

