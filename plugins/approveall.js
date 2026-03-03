const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/approveall.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { approvedAll: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || { approvedAll: [] };
  } catch (e) {
    return { approvedAll: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  command: 'approveall',
  aliases: ['approve-all'],
  category: 'moderation',
  description: 'Enable or disable approve-all for this chat',
  usage: '.approveall',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const data = readData();
    data.approvedAll = data.approvedAll || [];

    const exists = data.approvedAll.includes(chatId);
    if (exists) {
      data.approvedAll = data.approvedAll.filter(c => c !== chatId);
      writeData(data);
      await sock.sendMessage(chatId, { text: '✅ Approve-all disabled for this chat.' }, { quoted: message });
    } else {
      data.approvedAll.push(chatId);
      writeData(data);
      await sock.sendMessage(chatId, { text: '✅ Approve-all enabled for this chat.' }, { quoted: message });
    }
  }
};
