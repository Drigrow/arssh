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

    let visibleSessionIds = [];
    if (layoutMode === 'single') {
      const active = openSessions.find(s => s.instanceId === activeSessionId);
      if (active) visibleSessionIds = [active.instanceId];
      else visibleSessionIds = [openSessions[0].instanceId];
    } else if (layoutMode === 'split-vertical' || layoutMode === 'split-horizontal') {
      visibleSessionIds = openSessions.slice(0, 2).map(s => s.instanceId);
    } else if (layoutMode === 'grid') {
      visibleSessionIds = openSessions.slice(0, 4).map(s => s.instanceId);
    }
    
    return (
      <div className={`layout-container ${layoutMode}`}>
        {openSessions.map(session => {
          const isVisible = visibleSessionIds.includes(session.instanceId);
          return (
            <div 
              key={session.instanceId} 
              className={`pane ${session.instanceId === activeSessionId ? 'pane-active' : ''}`} 
              style={{ display: isVisible ? 'flex' : 'none' }}
              onClick={() => setActiveSessionId(session.instanceId)}
            >
              <Terminal 
                session={session} 
                onDisconnect={() => handleDisconnect(session.instanceId)} 
              />
            </div>
          );
        })}
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
        <div className="app-container" style={{ display: showConnectionManager ? 'flex' : 'none' }}>
          <ConnectionManager onConnect={handleConnect} />
        </div>
        <div style={{ display: showConnectionManager ? 'none' : 'flex', flex: 1, width: '100%', height: '100%' }}>
          {renderLayout()}
        </div>
      </div>
    </div>
  );
}
