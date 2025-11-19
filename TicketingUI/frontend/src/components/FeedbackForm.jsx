// FeedbackForm.jsx
// Form for TAs to add notes and feedback

import React, { useState } from 'react';
import { addFeedback } from '../services/ticketService';
import './FeedbackForm.css';

export default function FeedbackForm({ ticketId, taEmail, onFeedbackAdded }) {
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState('note');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!feedbackText.trim()) {
      setError('Please enter some feedback.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const newFeedback = await addFeedback(
        ticketId,
        taEmail,
        feedbackText.trim(),
        feedbackType,
        isInternal
      );

      // Clear form
      setFeedbackText('');
      setFeedbackType('note');
      setIsInternal(false);

      // Notify parent component
      if (onFeedbackAdded) {
        onFeedbackAdded(newFeedback);
      }
    } catch (err) {
      console.error('Error adding feedback:', err);
      setError('Failed to add feedback: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="feedback-form" onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="feedbackType">Type:</label>
        <select
          id="feedbackType"
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value)}
        >
          <option value="note">Note (Internal)</option>
          <option value="response">Response (Student-visible)</option>
          <option value="question">Question</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="feedbackText">Feedback:</label>
        <textarea
          id="feedbackText"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Enter your feedback, notes, or response..."
          rows={5}
          required
        />
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
          />
          Internal only (not visible to student)
        </label>
      </div>

      <button type="submit" disabled={submitting || !feedbackText.trim()}>
        {submitting ? 'Submitting...' : 'Add Feedback'}
      </button>
    </form>
  );
}

