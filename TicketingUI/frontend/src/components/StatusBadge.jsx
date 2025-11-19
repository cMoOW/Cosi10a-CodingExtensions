// StatusBadge.jsx
// Visual status indicator badge

import React from 'react';
import './StatusBadge.css';

export default function StatusBadge({ status }) {
  const statusConfig = {
    open: { label: 'Open', className: 'status-open' },
    in_progress: { label: 'In Progress', className: 'status-in-progress' },
    resolved: { label: 'Resolved', className: 'status-resolved' },
    closed: { label: 'Closed', className: 'status-closed' }
  };

  const config = statusConfig[status] || { label: status, className: 'status-unknown' };

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}

