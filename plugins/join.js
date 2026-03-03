const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/join.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { joinRequests: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || { joinRequests: [] };
  } catch (e) {
    return { joinRequests: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  command: 'join',
  aliases: [],
  category: 'general',
  description: 'Record a join request for this chat or notify bot to join',
  usage: '.join (optional reason)',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;
    const reason = args.join(' ').trim() || null;

    const data = readData();
    data.joinRequests = data.joinRequests || [];

    data.joinRequests.push({
      chatId,
      requester: sender,
      reason,
      timestamp: Date.now()
    });

    try {
      writeData(data);
      await sock.sendMessage(chatId, { text: '✅ Join request recorded.' }, { quoted: message });
    } catch (err) {
      console.error('join plugin error:', err);
      await sock.sendMessage(chatId, { text: '❌ Failed to record join request.' }, { quoted: message });
    }
  }
};
