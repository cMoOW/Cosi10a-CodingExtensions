// PriorityBadge.jsx
// Visual priority indicator badge

import React from 'react';
import './PriorityBadge.css';

export default function PriorityBadge({ priority }) {
  const priorityConfig = {
    low: { label: 'Low', className: 'priority-low' },
    medium: { label: 'Medium', className: 'priority-medium' },
    high: { label: 'High', className: 'priority-high' },
    urgent: { label: 'Urgent', className: 'priority-urgent' }
  };

  const config = priorityConfig[priority] || { label: priority, className: 'priority-unknown' };

  return (
    <span className={`priority-badge ${config.className}`}>
      {config.label}
    </span>
  );
}

