import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const getHistoryDir = () => {
  // Use project root assuming __dirname is inside 'main'
  // Or we can just use appData, but the user explicitly requested it local + in .gitignore.
  const historyDir = path.join(process.cwd(), '.arssh-history');
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  return historyDir;
};

const getFilePath = (dateStr) => {
  return path.join(getHistoryDir(), `${dateStr}.json`);
};

export default {
  saveCommand: (cmd, timestamp) => {
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filePath = getFilePath(dateStr);
    let commands = [];
    if (fs.existsSync(filePath)) {
      try {
        commands = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        commands = [];
      }
    }
    const newCmd = { id: Date.now() + Math.random(), time: timestamp, cmd };
    commands.unshift(newCmd); // add to top
    // Limit to 500 per day to prevent massive files
    if (commands.length > 500) commands = commands.slice(0, 500);
    fs.writeFileSync(filePath, JSON.stringify(commands, null, 2));
    return newCmd;
  },

  getCommands: (dateStr) => {
    const filePath = getFilePath(dateStr);
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        return [];
      }
    }
    return [];
  },

  deleteCommand: (dateStr, id) => {
    const filePath = getFilePath(dateStr);
    if (fs.existsSync(filePath)) {
      try {
        let commands = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        commands = commands.filter(c => c.id !== id);
        fs.writeFileSync(filePath, JSON.stringify(commands, null, 2));
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  },

  clearDate: (dateStr) => {
    const filePath = getFilePath(dateStr);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch (e) {
        return false;
      }
    }
    return true;
  }
};
