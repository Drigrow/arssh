import React, { useState, useEffect } from 'react';
import ConnectionManager from './components/ConnectionManager';
import Terminal from './components/Terminal';
import TabBar from './components/TabBar';

export default function App() {
  const [openSessions, setOpenSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [layoutMode, setLayoutMode] = useState('single'); // single, split-vertical, split-horizontal, grid
  const [showConnectionManager, setShowConnectionManager] = useState(true);

  // Update session status when IPC events arrive
  useEffect(() => {
    const cleanupStatus = window.electronAPI.onStatus((data) => {
      setOpenSessions(prev => prev.map(s => 
        s.instanceId === data.id ? { ...s, connectStatus: data.status } : s
      ));
    });
    return cleanupStatus;
  }, []);

  const handleConnect = async (connection) => {
    const instanceId = Date.now().toString();
    const newSession = { ...connection, instanceId, connectStatus: 'connecting' };
    
    setOpenSessions(prev => [...prev, newSession]);
    setActiveSessionId(instanceId);
    setShowConnectionManager(false);

    try {
      await window.electronAPI.connect(instanceId, newSession);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnect = async (instanceId) => {
    await window.electronAPI.disconnect(instanceId);
    handleCloseTab(instanceId);
  };

  const handleCloseTab = (instanceId) => {
    setOpenSessions(prev => {
      const filtered = prev.filter(s => s.instanceId !== instanceId);
      if (filtered.length === 0) {
        setShowConnectionManager(true);
        setActiveSessionId(null);
      } else if (activeSessionId === instanceId) {
        setActiveSessionId(filtered[filtered.length - 1].instanceId);
      }
      return filtered;
    });
    window.electronAPI.disconnect(instanceId);
  };

  const renderLayout = () => {
    if (openSessions.length === 0) return null;

    let visibleSessions = [];
    if (layoutMode === 'single') {
      const active = openSessions.find(s => s.instanceId === activeSessionId);
      if (active) visibleSessions = [active];
      else visibleSessions = [openSessions[0]];
    } else if (layoutMode === 'split-vertical' || layoutMode === 'split-horizontal') {
      visibleSessions = openSessions.slice(0, 2);
    } else if (layoutMode === 'grid') {
      visibleSessions = openSessions.slice(0, 4);
    }
    
    return (
      <div className={`layout-container ${layoutMode}`}>
        {visibleSessions.map(session => (
          <div key={session.instanceId} className={`pane ${session.instanceId === activeSessionId ? 'pane-active' : ''}`} onClick={() => setActiveSessionId(session.instanceId)}>
            <Terminal 
              session={session} 
              onDisconnect={() => handleDisconnect(session.instanceId)} 
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-layout">
      <TabBar 
        sessions={openSessions}
        activeSessionId={activeSessionId}
        onTabClick={(id) => {
          setActiveSessionId(id);
          setShowConnectionManager(false);
        }}
        onCloseTab={handleCloseTab}
        onAddTab={() => setShowConnectionManager(true)}
        layoutMode={layoutMode}
        onChangeLayout={setLayoutMode}
      />
      <div className="app-content">
        {showConnectionManager ? (
          <div className="app-container">
            <ConnectionManager onConnect={handleConnect} />
          </div>
        ) : (
          renderLayout()
        )}
      </div>
    </div>
  );
}
