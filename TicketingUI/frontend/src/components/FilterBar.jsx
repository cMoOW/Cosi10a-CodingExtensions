// FilterBar.jsx
// Filter controls for ticket list

import React from 'react';
import './FilterBar.css';

export default function FilterBar({ filters, onFilterChange }) {
  const handleChange = (key, value) => {
    onFilterChange({ [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      status: '',
      assignedTo: '',
      priority: '',
      studentEmail: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(f => f);

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label>Status:</label>
        <select 
          value={filters.status || ''} 
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Priority:</label>
        <select 
          value={filters.priority || ''} 
          onChange={(e) => handleChange('priority', e.target.value)}
        >
          <option value="">All</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Assigned to:</label>
        <select 
          value={filters.assignedTo || ''} 
          onChange={(e) => handleChange('assignedTo', e.target.value)}
        >
          <option value="">All</option>
          <option value="brianshen@brandeis.edu">Brian Shen</option>
          <option value="auppal@brandeis.edu">Apoorva Uppal</option>
          <option value="jacobcarminati@brandeis.edu">Jacob Carminati</option>
          <option value="siminglin@brandeis.edu">SiMing Lin</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Search:</label>
        <input
          type="text"
          placeholder="Student email..."
          value={filters.studentEmail || ''}
          onChange={(e) => handleChange('studentEmail', e.target.value)}
        />
      </div>

      {hasActiveFilters && (
        <button onClick={clearFilters} className="clear-filters-btn">
          Clear Filters
        </button>
      )}
    </div>
  );
}

