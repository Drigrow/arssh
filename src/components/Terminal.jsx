import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { XCircle, Activity } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

export default function Terminal({ session, onDisconnect }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting, connected, error, closed
  const statusRef = useRef(status);
  const [errorMsg, setErrorMsg] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

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
      // Show menu whether selected or not
      setContextMenu({ x: e.clientX, y: e.clientY });
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
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>
          <Activity size={14} color={status === 'connected' ? '#10b981' : (status === 'connecting' ? '#eab308' : '#ef4444')} />
          {session.name || session.host} - {status}
        </div>
        <div className="actions">
          <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={onDisconnect}>
            <XCircle size={14} /> Disconnect
          </button>
        </div>
      </div>
      <div className="terminal-wrapper" ref={terminalRef}></div>

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
