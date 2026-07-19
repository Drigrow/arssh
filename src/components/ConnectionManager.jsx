import React, { useState, useEffect } from 'react';
import { Terminal, Plus, Server, Key, Shield, Trash2, Edit2, Play, Lock } from 'lucide-react';

export default function ConnectionManager({ onConnect }) {
  const [connections, setConnections] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', host: '', port: '', username: '', password: '', privateKey: '', portForwarding: []
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    const conns = await window.electronAPI.getConnections();
    setConnections(conns);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const conn = { ...formData, id: editingId };
    await window.electronAPI.saveConnection(conn);
    setEditingId(null);
    setFormData({ name: '', host: '', port: '', username: '', password: '', privateKey: '', portForwarding: [] });
    loadConnections();
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm('Delete this connection?')) {
      await window.electronAPI.deleteConnection(id);
      loadConnections();
    }
  };

  const handleEdit = (conn, e) => {
    e.stopPropagation();
    setEditingId(conn.id);
    setFormData({
      name: conn.name || '',
      host: conn.host || '',
      port: conn.port || '',
      username: conn.username || '',
      password: conn.password || '', // Password might be decrypted from main process
      privateKey: conn.privateKey || '',
      portForwarding: conn.portForwarding || []
    });
  };

  const addPortForward = () => {
    setFormData(prev => ({
      ...prev,
      portForwarding: [...prev.portForwarding, { localPort: '', remoteHost: '127.0.0.1', remotePort: '' }]
    }));
  };

  const updatePortForward = (index, field, value) => {
    const newPf = [...formData.portForwarding];
    newPf[index][field] = value;
    setFormData(prev => ({ ...prev, portForwarding: newPf }));
  };

  const removePortForward = (index) => {
    setFormData(prev => ({
      ...prev,
      portForwarding: prev.portForwarding.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="connection-manager">
      <div className="sidebar glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2><Terminal size={20} style={{ verticalAlign: 'text-bottom', marginRight: 8 }}/> Servers</h2>
          <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%' }} onClick={() => {
            setEditingId(null);
            setFormData({ name: '', host: '', port: '', username: '', password: '', privateKey: '', portForwarding: [] });
          }}>
            <Plus size={16} />
          </button>
        </div>
        
        <div className="connection-list">
          {connections.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
              No connections saved.
            </div>
          ) : (
            connections.map(conn => (
              <div key={conn.id} className="connection-item">
                <div className="connection-info">
                  <strong>{conn.name || conn.host}</strong>
                  <span>{conn.username || 'root'}@{conn.host}:{conn.port || '22'}</span>
                </div>
                <div className="actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }} onClick={() => onConnect(conn)}>
                    <Play size={14} /> Connect
                  </button>
                  <button className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }} onClick={(e) => handleEdit(conn, e)}>
                    <Edit2 size={14} /> Edit
                  </button>
                  <button className="btn btn-danger" style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }} onClick={(e) => handleDelete(conn.id, e)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main-content glass-panel" style={{ overflowY: 'auto' }}>
        <h2>{editingId ? 'Edit Connection' : 'New Connection'}</h2>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Profile Name</label>
            <input className="form-control" placeholder="Production Server" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 3 }}>
              <label>Hostname / IP</label>
              <div style={{ position: 'relative' }}>
                <Server size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
                <input className="form-control" style={{ paddingLeft: '2.5rem' }} placeholder="192.168.1.1" value={formData.host} onChange={e => setFormData({...formData, host: e.target.value})} required />
              </div>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Port</label>
              <input className="form-control" placeholder="22" value={formData.port} onChange={e => setFormData({...formData, port: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Username</label>
            <input className="form-control" placeholder="root" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
          </div>

          <div className="form-group">
            <label>Password (Securely Encrypted)</label>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
              <input type="password" className="form-control" style={{ paddingLeft: '2.5rem' }} placeholder="Leave blank if using Private Key" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
          </div>

          <div className="form-group">
            <label>Private Key (Optional)</label>
            <textarea className="form-control" rows={3} placeholder="-----BEGIN PRIVATE KEY-----&#10;..." value={formData.privateKey} onChange={e => setFormData({...formData, privateKey: e.target.value})} />
          </div>

          <div className="port-forwarding-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}><Shield size={16} style={{ verticalAlign: 'text-bottom', marginRight: 8 }}/> Port Forwarding (Local to Remote)</h3>
              <button type="button" className="btn btn-secondary" onClick={addPortForward} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                <Plus size={14} /> Add Tunnel
              </button>
            </div>
            
            {formData.portForwarding.map((pf, index) => (
              <div key={index} className="pf-row">
                <input className="form-control" placeholder="Local Port (e.g. 8080)" value={pf.localPort} onChange={e => updatePortForward(index, 'localPort', e.target.value)} required />
                <input className="form-control" placeholder="Remote Host (e.g. 127.0.0.1)" value={pf.remoteHost} onChange={e => updatePortForward(index, 'remoteHost', e.target.value)} required />
                <input className="form-control" placeholder="Remote Port (e.g. 80)" value={pf.remotePort} onChange={e => updatePortForward(index, 'remotePort', e.target.value)} required />
                <button type="button" className="btn btn-danger" style={{ padding: '0.5rem' }} onClick={() => removePortForward(index)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {formData.portForwarding.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No port forwarding rules.</div>
            )}
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              <Lock size={16} /> Save Connection
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" style={{ flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success-color)' }} onClick={() => onConnect({...formData, id: editingId})}>
                <Play size={16} /> Connect Now
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
