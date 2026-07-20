import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { XCircle, Activity, History, X, TerminalSquare } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

export default function Terminal({ session, onDisconnect }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [status, setStatus] = useState(session.connectStatus || 'connecting'); // connecting, connected, error, closed
  const statusRef = useRef(status);
  const [errorMsg, setErrorMsg] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDate, setHistoryDate] = useState(getTodayStr());
  const historyDateRef = useRef(historyDate);
  const [commandHistory, setCommandHistory] = useState([]);
  const cmdBuffer = useRef('');
  const [confirmModal, setConfirmModal] = useState(null);
  
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [commandInput, setCommandInput] = useState('');

  useEffect(() => {
    historyDateRef.current = historyDate;
    window.electronAPI.historyGet(historyDate).then(setCommandHistory);
  }, [historyDate]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // Robust resizing using ResizeObserver
  useEffect(() => {
    if (!terminalRef.current) return;
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = xtermRef.current;
          if (statusRef.current === 'connected') {
            window.electronAPI.resize(session.instanceId, cols, rows);
          }
        } catch (e) {
          // Ignore if terminal isn't fully ready
        }
      }
    });
    // We observe the parent container to track flex layout changes
    observer.observe(terminalRef.current.parentElement);
    return () => observer.disconnect();
  }, [session.instanceId]);

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

    if (statusRef.current === 'connecting') {
      term.writeln(`\r\n\x1b[36mConnecting to ${session.host}...\x1b[0m\r\n`);
    }

    // Handle input
    term.onData(data => {
      if (statusRef.current === 'connected') {
        window.electronAPI.write(session.instanceId, data);
        
        // Command buffering
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          if (char === '\r') {
            const cmd = cmdBuffer.current.trim();
            if (cmd) {
              const timeStr = new Date().toLocaleTimeString();
              window.electronAPI.historySave(cmd, timeStr).then(savedCmd => {
                if (historyDateRef.current === getTodayStr()) {
                  setCommandHistory(prev => [savedCmd, ...prev]);
                }
              });
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
              window.electronAPI.write(session.instanceId, text);
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
            window.electronAPI.write(session.instanceId, text);
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

    // Resize handler (kept for window resizes, though ResizeObserver usually catches these too)
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = xtermRef.current;
          if (statusRef.current === 'connected') {
            window.electronAPI.resize(session.instanceId, cols, rows);
          }
        } catch (e) {}
      }
    };
    window.addEventListener('resize', handleResize);

    // IPC Listeners
    const cleanupData = window.electronAPI.onData((data) => {
      if (data.id === session.instanceId && xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    });

    const cleanupStatus = window.electronAPI.onStatus((data) => {
      if (data.id === session.instanceId) {
        if (data.status === 'connected' && statusRef.current === 'connecting') {
          term.writeln('\x1b[32mConnection established.\x1b[0m\r\n');
        }
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
  }, [session.instanceId]);

  return (
    <div className="terminal-container">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>
            <Activity size={14} color={status === 'connected' ? '#10b981' : (status === 'connecting' ? '#eab308' : '#ef4444')} />
            {session.name || session.host} - {status}
          </div>
          <div className="actions" style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => setCommandBarOpen(!commandBarOpen)}>
              <TerminalSquare size={14} /> Command Bar
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => setHistoryOpen(!historyOpen)}>
              <History size={14} /> History
            </button>
            <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={onDisconnect}>
              <XCircle size={14} /> Disconnect
            </button>
          </div>
        </div>
        <div className="terminal-wrapper-outer">
          <div className="terminal-wrapper" ref={terminalRef}></div>
        </div>
        {commandBarOpen && (
          <div className="command-bar" style={{ display: 'flex', padding: '0.5rem', background: '#1e1e1e', borderTop: '1px solid #333' }}>
            <textarea
              className="form-control"
              style={{ flex: 1, resize: 'none', height: '80px', fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '13px', background: '#000', color: '#10b981', border: '1px solid #333' }}
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const cmdTrimmed = commandInput.trim();
                  if (cmdTrimmed && statusRef.current === 'connected') {
                    const payload = commandInput.replace(/\n/g, '\r') + '\r';
                    window.electronAPI.write(session.instanceId, payload);
                    
                    // Save to history
                    const timeStr = new Date().toLocaleTimeString();
                    window.electronAPI.historySave(cmdTrimmed, timeStr).then(savedCmd => {
                      if (historyDateRef.current === getTodayStr()) {
                        setCommandHistory(prev => [savedCmd, ...prev]);
                      }
                    });

                    setCommandInput('');
                    // Refocus terminal
                    xtermRef.current?.focus();
                  }
                }
              }}
              placeholder="Pre-input commands here... (Enter to send, Shift+Enter for new line)"
            />
          </div>
        )}
      </div>

      <div className={`history-panel ${historyOpen ? '' : 'collapsed'}`}>
        <div className="history-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Command History</span>
              <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setHistoryOpen(false)} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="date" 
                className="form-control" 
                style={{ padding: '0.2rem', fontSize: '0.8rem' }} 
                value={historyDate}
                onChange={e => setHistoryDate(e.target.value)}
              />
              <button className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }} onClick={() => {
                if (confirm('Clear all history for ' + historyDate + '?')) {
                  window.electronAPI.historyClear(historyDate).then(() => setCommandHistory([]));
                }
              }}>Clear Day</button>
            </div>
          </div>
        </div>
        <div className="history-content">
          {commandHistory.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>No history recorded for this date.</div>
          ) : (
            commandHistory.map(item => (
              <div key={item.id} className="history-item" style={{ position: 'relative' }}>
                <div onClick={() => {
                  const muteTime = localStorage.getItem('arssh_history_mute');
                  if (muteTime && Date.now() - parseInt(muteTime) < 15 * 60 * 1000) {
                    window.electronAPI.write(session.instanceId, item.cmd + '\r');
                  } else {
                    setConfirmModal(item.cmd);
                  }
                }}>
                  <div className="history-time">{item.time}</div>
                  <div className="history-cmd">{item.cmd}</div>
                </div>
                <X 
                  size={14} 
                  color="#ef4444" 
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.electronAPI.historyDelete(historyDate, item.id).then(success => {
                      if (success) {
                        setCommandHistory(prev => prev.filter(c => c.id !== item.id));
                      }
                    });
                  }}
                />
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
                window.electronAPI.write(session.instanceId, confirmModal + '\r');
                setConfirmModal(null);
              }}>Yes</button>
              <button className="btn btn-secondary" onClick={() => {
                localStorage.setItem('arssh_history_mute', Date.now().toString());
                window.electronAPI.write(session.instanceId, confirmModal + '\r');
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
                window.electronAPI.write(session.instanceId, text);
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
