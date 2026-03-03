const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/left.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { leftEvents: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || { leftEvents: [] };
  } catch (e) {
    return { leftEvents: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  command: 'left',
  aliases: ['leave', 'leftchat'],
  category: 'general',
  description: 'Record a left/leave event for this chat or a mentioned chat',
  usage: '.left',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;
    const targetArg = args[0];

    const target = targetArg ? (targetArg.includes('@') ? targetArg : `${targetArg}@s.whatsapp.net`) : chatId;

    const data = readData();
    data.leftEvents = data.leftEvents || [];

    data.leftEvents.push({ chatId: target, leftBy: sender, timestamp: Date.now() });

    try {
      writeData(data);
      await sock.sendMessage(chatId, { text: `✅ Recorded left event for ${target.split('@')[0]}` }, { quoted: message });
    } catch (err) {
      console.error('left plugin error:', err);
      await sock.sendMessage(chatId, { text: '❌ Failed to record left event.' }, { quoted: message });
    }
  }
};
