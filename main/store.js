import Store from 'electron-store';
import { safeStorage } from 'electron';

class StoreManager {
  constructor() {
    this.store = new Store({
      name: 'nexus-ssh-connections',
      defaults: {
        connections: []
      }
    });
  }

  init() {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('safeStorage is not available. Passwords will be saved in plain text (not recommended).');
    }
  }

  getConnections() {
    const conns = this.store.get('connections');
    return conns.map(conn => {
      // Decrypt password if it exists
      if (conn.passwordEncrypted) {
        try {
          if (safeStorage.isEncryptionAvailable()) {
            conn.password = safeStorage.decryptString(Buffer.from(conn.passwordEncrypted, 'base64'));
          } else {
            conn.password = Buffer.from(conn.passwordEncrypted, 'base64').toString('utf-8');
          }
        } catch (e) {
          console.error('Failed to decrypt password for', conn.name);
          conn.password = '';
        }
      }
      return conn;
    });
  }

  saveConnection(conn) {
    const conns = this.store.get('connections');
    
    // Encrypt password
    if (conn.password) {
      if (safeStorage.isEncryptionAvailable()) {
        conn.passwordEncrypted = safeStorage.encryptString(conn.password).toString('base64');
      } else {
        conn.passwordEncrypted = Buffer.from(conn.password).toString('base64');
      }
      delete conn.password; // Don't store plain text password
    }

    if (conn.id) {
      const idx = conns.findIndex(c => c.id === conn.id);
      if (idx !== -1) {
        conns[idx] = conn;
      } else {
        conns.push(conn);
      }
    } else {
      conn.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      conns.push(conn);
    }

    this.store.set('connections', conns);
    return this.getConnections(); // Return updated list
  }

  deleteConnection(id) {
    const conns = this.store.get('connections');
    const filtered = conns.filter(c => c.id !== id);
    this.store.set('connections', filtered);
    return this.getConnections();
  }
}

export default new StoreManager();
