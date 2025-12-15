// TicketCard.jsx
// Individual ticket preview card

import React from 'react';
import StatusBadge from './StatusBadge';
import './TicketCard.css';

export default function TicketCard({ ticket, onClick }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return 'No message';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="ticket-card" onClick={onClick}>
      <div className="ticket-card-header">
        <div className="ticket-card-title">
          <h3>Ticket #{ticket.id.substring(0, 8)}</h3>
          <div className="badge-group">
            <StatusBadge status={ticket.status} />
          </div>
        </div>
      </div>

      <div className="ticket-card-body">
        <div className="ticket-info-row">
          <span className="label">Student:</span>
          <span className="value">{ticket.student_email}</span>
        </div>

        <div className="ticket-info-row">
          <span className="label">Message:</span>
          <span className="value">{truncateText(ticket.message)}</span>
        </div>

        {ticket.assigned_to && (
          <div className="ticket-info-row">
            <span className="label">Assigned to:</span>
            <span className="value">{ticket.assigned_to}</span>
          </div>
        )}

        {ticket.file_name && (
          <div className="ticket-info-row">
            <span className="label">File:</span>
            <span className="value">{ticket.file_name}</span>
          </div>
        )}

        <div className="ticket-info-row">
          <span className="label">Created:</span>
          <span className="value">{formatDate(ticket.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

