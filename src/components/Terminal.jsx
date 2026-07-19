import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { XCircle, Activity, History, X } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

export default function Terminal({ session, onDisconnect }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting, connected, error, closed
  const statusRef = useRef(status);
  const [errorMsg, setErrorMsg] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commandHistory, setCommandHistory] = useState([]);
  const cmdBuffer = useRef('');
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    // Initialize xterm
    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      theme: {
        background: '#000000',
        foreground: '#e2e8f0',
        cursor: '#3b82f6',
        cursorAccent: '#000000',
        selection: 'rgba(59, 130, 246, 0.3)',
        black: '#0f111a',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#ffffff',
      },
      cursorBlink: true,
      allowProposedApi: true
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle input
    term.onData(data => {
      if (statusRef.current === 'connected') {
        window.electronAPI.write(session.id, data);
        
        // Command buffering
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          if (char === '\r') {
            const cmd = cmdBuffer.current.trim();
            if (cmd) {
              setCommandHistory(prev => [{ id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), cmd }, ...prev].slice(0, 50));
            }
            cmdBuffer.current = '';
          } else if (char === '\x7f' || char === '\b') {
            cmdBuffer.current = cmdBuffer.current.slice(0, -1);
          } else if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) {
            cmdBuffer.current += char;
          }
        }
      }
    });

    // Custom Key Shortcuts (Copy/Paste)
    term.attachCustomKeyEventHandler(e => {
      // Copy: Ctrl+Shift+C or Ctrl+Insert
      if ((e.ctrlKey && e.shiftKey && e.code === 'KeyC') || (e.ctrlKey && e.code === 'Insert')) {
        if (e.type === 'keydown') {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
            term.clearSelection();
          }
        }
        return false;
      }
      // Paste: Ctrl+Shift+V or Shift+Insert
      if ((e.ctrlKey && e.shiftKey && e.code === 'KeyV') || (e.shiftKey && e.code === 'Insert')) {
        if (e.type === 'keydown') {
          navigator.clipboard.readText().then(text => {
            if (statusRef.current === 'connected' && text) {
              window.electronAPI.write(session.id, text);
            }
          }).catch(err => console.error('Failed to read clipboard', err));
        }
        return false;
      }
      return true;
    });

    // Middle Click to Paste
    const handleMouseUp = (e) => {
      if (e.button === 1) { // Middle mouse button
        navigator.clipboard.readText().then(text => {
          if (statusRef.current === 'connected' && text) {
            window.electronAPI.write(session.id, text);
          }
        }).catch(err => console.error('Failed to read clipboard', err));
      }
    };
    terminalRef.current.addEventListener('mouseup', handleMouseUp);

    // Context Menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      
      const menuWidth = 220;
      const menuHeight = 160; // Approximate height of the menu

      let x = e.clientX;
      let y = e.clientY;

      if (window.innerWidth - x < menuWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (window.innerHeight - y < menuHeight) {
        y = window.innerHeight - menuHeight - 10;
      }

      setContextMenu({ x, y });
    };
    terminalRef.current.addEventListener('contextmenu', handleContextMenu);

    // Resize handler
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = xtermRef.current;
        if (statusRef.current === 'connected') {
          window.electronAPI.resize(session.id, cols, rows);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    // IPC Listeners
    const cleanupData = window.electronAPI.onData((data) => {
      if (data.id === session.id && xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    });

    const cleanupStatus = window.electronAPI.onStatus((data) => {
      if (data.id === session.id) {
        setStatus(data.status);
        if (data.status === 'connected') {
          term.focus();
          handleResize(); // Initial resize
        }
        if (data.message) {
          setErrorMsg(data.message);
          term.writeln(`\r\n\x1b[31m[Error] ${data.message}\x1b[0m\r\n`);
        }
        if (data.status === 'closed') {
          term.writeln('\r\n\x1b[33m[Connection Closed]\x1b[0m\r\n');
        }
      }
    });

    return () => {
      cleanupData();
      cleanupStatus();
      window.removeEventListener('resize', handleResize);
      if (terminalRef.current) {
        terminalRef.current.removeEventListener('mouseup', handleMouseUp);
        terminalRef.current.removeEventListener('contextmenu', handleContextMenu);
      }
      term.dispose();
    };
  }, [session.id]);

  return (
    <div className="terminal-container">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>
            <Activity size={14} color={status === 'connected' ? '#10b981' : (status === 'connecting' ? '#eab308' : '#ef4444')} />
            {session.name || session.host} - {status}
          </div>
          <div className="actions" style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => setHistoryOpen(!historyOpen)}>
              <History size={14} /> History
            </button>
            <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={onDisconnect}>
              <XCircle size={14} /> Disconnect
            </button>
          </div>
        </div>
        <div className="terminal-wrapper" ref={terminalRef}></div>
      </div>

      <div className={`history-panel ${historyOpen ? '' : 'collapsed'}`}>
        <div className="history-header">
          <span>Command History</span>
          <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setHistoryOpen(false)} />
        </div>
        <div className="history-content">
          {commandHistory.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>No history recorded.</div>
          ) : (
            commandHistory.map(item => (
              <div key={item.id} className="history-item" onClick={() => {
                const muteTime = localStorage.getItem('arssh_history_mute');
                if (muteTime && Date.now() - parseInt(muteTime) < 15 * 60 * 1000) {
                  window.electronAPI.write(session.id, item.cmd + '\r');
                } else {
                  setConfirmModal(item.cmd);
                }
              }}>
                <div className="history-time">{item.time}</div>
                <div className="history-cmd">{item.cmd}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {confirmModal && (
        <div className="modal-overlay">
          <div className="history-modal">
            <h3>Paste and Send to Terminal?</h3>
            <div className="cmd-preview">{confirmModal}</div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={() => {
                window.electronAPI.write(session.id, confirmModal + '\r');
                setConfirmModal(null);
              }}>Yes</button>
              <button className="btn btn-secondary" onClick={() => {
                localStorage.setItem('arssh_history_mute', Date.now().toString());
                window.electronAPI.write(session.id, confirmModal + '\r');
                setConfirmModal(null);
              }}>Yes, and don't ask me again in 15 minutes</button>
              <button className="btn btn-secondary" style={{ backgroundColor: '#333' }} onClick={() => setConfirmModal(null)}>No, Cancel</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div 
          className="context-menu glass-panel"
          style={{ 
            position: 'fixed', 
            top: contextMenu.y, 
            left: contextMenu.x, 
            zIndex: 1000,
            padding: '0.5rem 0',
            minWidth: '220px'
          }}
        >
          <div className="menu-item" onClick={onDisconnect}>
            <span>Disconnect</span>
            <span className="shortcut">Alt+C</span>
          </div>
          <div className="menu-divider"></div>
          <div className="menu-item" onClick={() => {
            const selection = xtermRef.current?.getSelection();
            if (selection) {
              navigator.clipboard.writeText(selection);
              xtermRef.current?.clearSelection();
            }
          }}>
            <span>Copy</span>
            <span className="shortcut">Ctrl+Shift+C</span>
          </div>
          <div className="menu-item" onClick={() => {
            navigator.clipboard.readText().then(text => {
              if (statusRef.current === 'connected' && text) {
                window.electronAPI.write(session.id, text);
              }
            }).catch(err => console.error('Failed to read clipboard', err));
          }}>
            <span>Paste</span>
            <span className="shortcut">Ctrl+Shift+V</span>
          </div>
          <div className="menu-divider"></div>
          <div className="menu-item" onClick={() => xtermRef.current?.clear()}>
            <span>Clear Screen</span>
          </div>
        </div>
      )}
    </div>
  );
}
