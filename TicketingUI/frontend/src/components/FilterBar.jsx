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
      status: 'open', // Default to open tickets
      assignedTo: '',
      studentEmail: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(f => f);

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label>Status:</label>
        <select 
          value={filters.status || 'open'} 
          onChange={(e) => handleChange('status', e.target.value)}
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
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

