// TicketDetail.jsx
// Full ticket view with all details and TA interaction

import React, { useState, useEffect } from 'react';
import { getTicketWithFeedback, updateTicketStatus, assignTicket, updateTicketPriority } from '../services/ticketService';
import CodeViewer from './CodeViewer';
import FeedbackForm from './FeedbackForm';
import FeedbackList from './FeedbackList';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import './TicketDetail.css';

export default function TicketDetail({ ticketId, currentTAEmail, onBack, onUpdate }) {
  const [ticket, setTicket] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTicketDetails();
  }, [ticketId]);

  async function fetchTicketDetails() {
    try {
      setLoading(true);
      setError(null);
      const { ticket: ticketData, feedback: feedbackData } = await getTicketWithFeedback(ticketId);
      setTicket(ticketData);
      setFeedback(feedbackData);
    } catch (err) {
      console.error('Error fetching ticket details:', err);
      setError('Failed to load ticket details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus) {
    try {
      setUpdating(true);
      const updated = await updateTicketStatus(ticketId, newStatus, currentTAEmail);
      setTicket(updated);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssign(taEmail) {
    try {
      setUpdating(true);
      const updated = await assignTicket(ticketId, taEmail);
      setTicket(updated);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error assigning ticket:', err);
      alert('Failed to assign ticket: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handlePriorityChange(newPriority) {
    try {
      setUpdating(true);
      const updated = await updateTicketPriority(ticketId, newPriority);
      setTicket(updated);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error updating priority:', err);
      alert('Failed to update priority: ' + err.message);
    } finally {
      setUpdating(false);
    }
  }

  function handleFeedbackAdded(newFeedback) {
    setFeedback(prev => [newFeedback, ...prev]);
    if (onUpdate) onUpdate();
  }

  if (loading) {
    return <div className="ticket-detail-container"><div className="loading">Loading ticket...</div></div>;
  }

  if (error || !ticket) {
    return (
      <div className="ticket-detail-container">
        <div className="error">{error || 'Ticket not found'}</div>
        <button onClick={onBack}>Back to List</button>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const TA_EMAILS = [
    { name: 'Brian Shen', email: 'brianshen@brandeis.edu' },
    { name: 'Apoorva Uppal', email: 'auppal@brandeis.edu' },
    { name: 'Jacob Carminati', email: 'jacobcarminati@brandeis.edu' },
    { name: 'SiMing Lin', email: 'siminglin@brandeis.edu' }
  ];

  return (
    <div className="ticket-detail-container">
      <div className="ticket-detail-header">
        <button onClick={onBack} className="back-btn">← Back to List</button>
        <div className="header-actions">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </div>

      <div className="ticket-detail-content">
        {/* Ticket Information */}
        <section className="ticket-info-section">
          <h2>Ticket #{ticket.id.substring(0, 8)}</h2>
          
          <div className="info-grid">
            <div className="info-item">
              <label>Student Email:</label>
              <span>{ticket.student_email}</span>
            </div>
            <div className="info-item">
              <label>Created:</label>
              <span>{formatDate(ticket.created_at)}</span>
            </div>
            <div className="info-item">
              <label>Last Updated:</label>
              <span>{formatDate(ticket.updated_at)}</span>
            </div>
            {ticket.assigned_to && (
              <div className="info-item">
                <label>Assigned to:</label>
                <span>{ticket.assigned_to}</span>
              </div>
            )}
            {ticket.file_name && (
              <div className="info-item">
                <label>File:</label>
                <span>{ticket.file_name}</span>
              </div>
            )}
            {ticket.language && (
              <div className="info-item">
                <label>Language:</label>
                <span>{ticket.language}</span>
              </div>
            )}
          </div>
        </section>

        {/* Student Message */}
        <section className="message-section">
          <h3>Student Message</h3>
          <div className="message-content">{ticket.message}</div>
        </section>

        {/* Code Display */}
        {(ticket.highlighted_code || ticket.full_code) && (
          <section className="code-section">
            <h3>Code</h3>
            {ticket.highlighted_code && (
              <div className="code-block">
                <h4>Highlighted Section</h4>
                <CodeViewer 
                  code={ticket.highlighted_code} 
                  language={ticket.language || 'text'}
                />
              </div>
            )}
            {ticket.full_code && (
              <div className="code-block">
                <h4>Full Code</h4>
                <CodeViewer 
                  code={ticket.full_code} 
                  language={ticket.language || 'text'}
                />
              </div>
            )}
          </section>
        )}

        {/* TA Actions */}
        <section className="actions-section">
          <h3>Actions</h3>
          <div className="action-buttons">
            <div className="action-group">
              <label>Status:</label>
              <select 
                value={ticket.status} 
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="action-group">
              <label>Priority:</label>
              <select 
                value={ticket.priority} 
                onChange={(e) => handlePriorityChange(e.target.value)}
                disabled={updating}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="action-group">
              <label>Assign to:</label>
              <select 
                value={ticket.assigned_to || ''} 
                onChange={(e) => handleAssign(e.target.value)}
                disabled={updating}
              >
                <option value="">Unassigned</option>
                {TA_EMAILS.map(ta => (
                  <option key={ta.email} value={ta.email}>
                    {ta.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Resolution */}
        {ticket.resolution && (
          <section className="resolution-section">
            <h3>Resolution</h3>
            <div className="resolution-content">{ticket.resolution}</div>
            {ticket.resolved_by && (
              <div className="resolved-by">
                Resolved by: {ticket.resolved_by} on {formatDate(ticket.resolved_at)}
              </div>
            )}
          </section>
        )}

        {/* Feedback History */}
        <section className="feedback-section">
          <h3>Feedback & Notes</h3>
          <FeedbackList feedback={feedback} />
        </section>

        {/* Add Feedback Form */}
        <section className="add-feedback-section">
          <h3>Add Feedback</h3>
          <FeedbackForm 
            ticketId={ticketId}
            taEmail={currentTAEmail}
            onFeedbackAdded={handleFeedbackAdded}
          />
        </section>
      </div>
    </div>
  );
}

