const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/approve.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { approved: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || { approved: [] };
  } catch (e) {
    return { approved: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  command: 'approve',
  aliases: [],
  category: 'moderation',
  description: 'Approve a user (add to approved list)',
  usage: '.approve @user or reply',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let target = null;

    if (mentioned.length) target = mentioned[0];
    else if (quoted) target = quoted.sender;
    else if (args[0]) target = args[0].includes('@') ? args[0] : `${args[0]}@s.whatsapp.net`;
    else target = message.key.participant || message.key.remoteJid;

    const data = readData();
    data.approved = data.approved || [];

    if (!data.approved.includes(target)) {
      data.approved.push(target);
      writeData(data);
      await sock.sendMessage(chatId, { text: `✅ Approved ${target.split('@')[0]}` }, { quoted: message });
    } else {
      await sock.sendMessage(chatId, { text: `ℹ️ ${target.split('@')[0]} is already approved.` }, { quoted: message });
    }
  }
};
