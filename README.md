<div align="center">
  <h1>🚀 arssh</h1>
  <p><strong>A Modern, Cross-Platform SSH Terminal Built with Electron & React</strong></p>
</div>

**arssh** is a beautifully designed, self-contained SSH client. Built using web technologies and powered by a robust native Node.js backend, it offers a fast, secure, and visually stunning alternative to standard terminals.

---

## ✨ Features

- 🎨 **Modern Glassmorphism UI**: A sleek, dark-mode first interface built with React and Vanilla CSS.
- 📑 **Multi-Tab & Split Layouts**: Effortlessly manage multiple connections with browser-like tabs. View your terminals side-by-side or in a 2x2 grid for ultimate productivity.
- 🔐 **Secure Credential Storage**: Passwords and private keys are encrypted down to the OS-level using Electron's `safeStorage` (e.g., DPAPI on Windows, Keychain on macOS).
- 🖥️ **Full Terminal Emulation**: Integrated with `@xterm/xterm` for dynamic resizing, accurate ANSI coloring, and native feeling shell interactions.
- 🌉 **Built-in Port Forwarding**: Easily configure Local-to-Remote SSH tunnels (e.g., `8080 -> 127.0.0.1:80`) dynamically when you connect.
- 🛡️ **Global TUN Proxy Safe**: Custom backend proxy routing completely bypasses Electron Chromium's native proxy stack, eliminating `ERR_CONNECTION_REFUSED` and handshake errors when using tools like Clash, V2ray, or Sing-box.
- 🤖 **AI Integration (Coming Soon)**: Get ready for intelligent, context-aware assistance built right into your terminal workflow.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Drigrow/arssh.git
   cd arssh
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   *This will launch the Vite frontend and the Electron app simultaneously.*

---

## 📦 Building for Production (Publishing)

arssh uses `electron-builder` to easily compile the application into a standalone executable. Native modules (like `ssh2` crypto APIs) will automatically recompile to match Electron's Node version.

To build the executable for your current operating system (Windows `.exe` / macOS `.dmg` / Linux `.AppImage`), simply run:

```bash
npm run build
```

Your compiled, publish-ready files will be available inside the `/dist` directory.

---

## 🛠️ Technology Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **SSH Engine**: [ssh2](https://github.com/mscdex/ssh2)
- **Terminal Emulator**: [xterm.js](https://xtermjs.org/)
- **Storage**: [electron-store](https://github.com/sindresorhus/electron-store)

---

## 📄 License

This project is open-source and available under the standard MIT License. Feel free to fork, modify, and distribute it!
