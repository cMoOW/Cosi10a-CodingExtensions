// App.jsx
// Main application component

import React, { useState } from 'react';
import TicketList from './components/TicketList';
import TicketDetail from './components/TicketDetail';
import Login from './components/Login';
import './App.css';

// TODO: Replace with actual authentication later
// const CURRENT_TA_EMAIL = 'ta@brandeis.edu'; // For now, hardcoded. Replace with auth later.

function App() {
  const [currentTAEmail, setCurrentTAEmail] = useState(null);
  const [currentTAPassword, setCurrentTAPassword] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLogin = (email, password) => {
    setCurrentTAEmail(email);
    setCurrentTAPassword(password);
  }

  const handleTicketSelect = (ticketId) => {
    setSelectedTicketId(ticketId);
  };

  const handleBack = () => {
    setSelectedTicketId(null);
    setRefreshKey(prev => prev + 1); // Trigger refresh of ticket list
  };

  const handleTicketUpdate = () => {
    // Refresh ticket list when ticket is updated
    setRefreshKey(prev => prev + 1);
  };

  if(!currentTAEmail) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ticket Management System</h1>
        <div className="header-info">
          <span>TA: {currentTAEmail}</span>
        </div>
      </header>

      <main className="app-main">
        {selectedTicketId ? (
          <TicketDetail
            ticketId={selectedTicketId}
            currentTAEmail={currentTAEmail}
            onBack={handleBack}
            onUpdate={handleTicketUpdate}
          />
        ) : (
          <TicketList
            key={refreshKey}
            onTicketSelect={handleTicketSelect}
          />
        )}
      </main>
    </div>
  );
}

export default App;

