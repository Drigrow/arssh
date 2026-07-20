import React from 'react';
import { X, Plus, Columns, LayoutGrid, Square, Columns3 } from 'lucide-react';

export default function TabBar({ sessions, activeSessionId, onTabClick, onCloseTab, onAddTab, layoutMode, onChangeLayout }) {
  return (
    <div className="tab-bar">
      <div className="tabs">
        {sessions.map(session => (
          <div
            key={session.instanceId}
            className={`tab ${session.instanceId === activeSessionId ? 'active' : ''}`}
            onClick={() => onTabClick(session.instanceId)}
          >
            <div className={`tab-indicator ${session.connectStatus === 'connected' ? 'connected' : session.connectStatus === 'connecting' ? 'connecting' : 'error'}`}></div>
            <span className="tab-title">{session.name || session.host}</span>
            <button 
              className="tab-close" 
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(session.instanceId);
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button className="tab-add" onClick={onAddTab}>
          <Plus size={16} />
        </button>
      </div>
      
      <div className="layout-controls">
        <button className={`layout-btn ${layoutMode === 'single' ? 'active' : ''}`} onClick={() => onChangeLayout('single')} title="Single View">
          <Square size={16} />
        </button>
        <button className={`layout-btn ${layoutMode === 'split-vertical' ? 'active' : ''}`} onClick={() => onChangeLayout('split-vertical')} title="Vertical Split (Side by Side)">
          <Columns size={16} />
        </button>
        <button className={`layout-btn ${layoutMode === 'split-horizontal' ? 'active' : ''}`} onClick={() => onChangeLayout('split-horizontal')} title="Horizontal Split (Stacked)">
          <Columns size={16} style={{ transform: 'rotate(90deg)' }} />
        </button>
        <button className={`layout-btn ${layoutMode === 'grid' ? 'active' : ''}`} onClick={() => onChangeLayout('grid')} title="Grid View (2x2)">
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );
}
