// FeedbackList.jsx
// Displays list of feedback entries for a ticket

import React from 'react';
import './FeedbackList.css';

export default function FeedbackList({ feedback }) {
  if (!feedback || feedback.length === 0) {
    return <div className="no-feedback">No feedback yet.</div>;
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getFeedbackTypeLabel = (type) => {
    const labels = {
      note: '📝 Note',
      response: '💬 Response',
      question: '❓ Question'
    };
    return labels[type] || type;
  };

  return (
    <div className="feedback-list">
      {feedback.map(item => (
        <div key={item.id} className={`feedback-item ${item.is_internal ? 'internal' : ''}`}>
          <div className="feedback-header">
            <div className="feedback-meta">
              <span className="feedback-type">{getFeedbackTypeLabel(item.feedback_type)}</span>
              <span className="feedback-author">{item.ta_email}</span>
              <span className="feedback-date">{formatDate(item.created_at)}</span>
            </div>
            {item.is_internal && (
              <span className="internal-badge">Internal Only</span>
            )}
          </div>
          <div className="feedback-content">{item.feedback_text}</div>
        </div>
      ))}
    </div>
  );
}

