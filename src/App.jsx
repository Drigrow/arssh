import React, { useState } from 'react';
import ConnectionManager from './components/ConnectionManager';
import Terminal from './components/Terminal';

export default function App() {
  const [activeSession, setActiveSession] = useState(null);

  const handleConnect = async (connection) => {
    try {
      await window.electronAPI.connect(connection.id, connection);
      setActiveSession(connection);
    } catch (err) {
      alert(`Connection failed: ${err}`);
    }
  };

  const handleDisconnect = async () => {
    if (activeSession) {
      await window.electronAPI.disconnect(activeSession.id);
      setActiveSession(null);
    }
  };

  return (
    <>
      {!activeSession ? (
        <div className="app-container">
          <ConnectionManager onConnect={handleConnect} />
        </div>
      ) : (
        <Terminal 
          session={activeSession} 
          onDisconnect={handleDisconnect} 
        />
      )}
    </>
  );
}
