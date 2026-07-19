import { Client } from 'ssh2';
import net from 'net';
import { SocksClient } from 'socks';
import http from 'http';
import https from 'https';

async function getProxySocket(targetHost, targetPort) {
  let proxyStr = process.env.https_proxy || process.env.http_proxy || process.env.all_proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;

  if (!proxyStr) {
    // Try to detect common local proxy loop (e.g. clash on 7890)
    const isClashRunning = await new Promise(resolve => {
      const s = net.createConnection(7890, '127.0.0.1');
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('error', () => resolve(false));
      s.setTimeout(200, () => { s.destroy(); resolve(false); });
    });
    if (isClashRunning) {
      proxyStr = 'http://127.0.0.1:7890';
    }
  }

  if (!proxyStr) return null;

  if (!proxyStr.startsWith('http') && !proxyStr.startsWith('socks')) {
    proxyStr = 'http://' + proxyStr;
  }

  const proxyUrl = new URL(proxyStr);

  if (proxyUrl.protocol.startsWith('socks')) {
    const info = await SocksClient.createConnection({
      proxy: {
        host: proxyUrl.hostname,
        port: parseInt(proxyUrl.port) || 1080,
        type: proxyUrl.protocol === 'socks4:' ? 4 : 5
      },
      command: 'connect',
      destination: { host: targetHost, port: targetPort }
    });
    return info.socket;
  } else {
    return new Promise((resolve, reject) => {
      const req = (proxyUrl.protocol === 'https:' ? https : http).request({
        host: proxyUrl.hostname,
        port: proxyUrl.port,
        method: 'CONNECT',
        path: `${targetHost}:${targetPort}`
      });
      req.on('connect', (res, socket, head) => {
        if (res.statusCode === 200) {
          resolve(socket);
        } else {
          reject(new Error(`Proxy connection failed: ${res.statusCode}`));
        }
      });
      req.on('error', reject);
      req.end();
    });
  }
}

class SSHClientManager {
  constructor() {
    this.clients = new Map(); // id -> { client, stream, server }
  }

  async connect(id, config, mainWindow) {
    return new Promise((resolve, reject) => {
      if (this.clients.has(id)) {
        this.disconnect(id);
      }

      const conn = new Client();
      let stream = null;
      let forwardServer = null;

      conn.on('ready', () => {
        // Handle terminal session
        conn.shell((err, s) => {
          if (err) {
            reject(err.message);
            return;
          }
          mainWindow.webContents.send('ssh:status', { id, status: 'connected' });
          stream = s;
          
          this.clients.set(id, { client: conn, stream, server: forwardServer });

          stream.on('close', () => {
            conn.end();
          }).on('data', (data) => {
            mainWindow.webContents.send('ssh:data', { id, data: data.toString('utf-8') });
          });

          // Setup port forwarding if configured
          if (config.portForwarding && config.portForwarding.length > 0) {
            config.portForwarding.forEach(fwd => {
              const server = net.createServer(localSocket => {
                conn.forwardOut(
                  '127.0.0.1', localSocket.remotePort,
                  fwd.remoteHost, parseInt(fwd.remotePort),
                  (err, remoteStream) => {
                    if (err) {
                      localSocket.end();
                      return;
                    }
                    localSocket.pipe(remoteStream);
                    remoteStream.pipe(localSocket);
                  }
                );
              });

              server.listen(parseInt(fwd.localPort), '127.0.0.1', () => {
                console.log(`Port forwarded: ${fwd.localPort} -> ${fwd.remoteHost}:${fwd.remotePort}`);
              });

              // Keep track to close later
              const state = this.clients.get(id);
              if (!state.servers) state.servers = [];
              state.servers.push(server);
            });
          }

          resolve({ success: true });
        });
      }).on('error', (err) => {
        mainWindow.webContents.send('ssh:status', { id, status: 'error', message: err.message });
        reject(err.message);
      }).on('close', () => {
        mainWindow.webContents.send('ssh:status', { id, status: 'closed' });
        this.disconnect(id);
      });

      const connectConfig = {
        host: config.host,
        port: parseInt(config.port) || 22,
        username: config.username,
      };

      if (config.password) {
        connectConfig.password = config.password;
      } else if (config.privateKey) {
        connectConfig.privateKey = config.privateKey;
      }

      getProxySocket(connectConfig.host, connectConfig.port).then(socket => {
        if (socket) {
          connectConfig.sock = socket;
        }
        conn.connect(connectConfig);
      }).catch(err => {
        mainWindow.webContents.send('ssh:status', { id, status: 'error', message: 'Proxy Error: ' + err.message });
        reject(err.message);
      });
    });
  }

  disconnect(id) {
    const state = this.clients.get(id);
    if (state) {
      if (state.stream) state.stream.end();
      if (state.client) state.client.end();
      if (state.servers) {
        state.servers.forEach(s => s.close());
      }
      this.clients.delete(id);
    }
    return { success: true };
  }

  write(id, data) {
    const state = this.clients.get(id);
    if (state && state.stream) {
      state.stream.write(data);
    }
  }

  resize(id, cols, rows) {
    const state = this.clients.get(id);
    if (state && state.stream) {
      state.stream.setWindow(rows, cols, 480, 640); // default pixel sizes
    }
  }
}

export default new SSHClientManager();
