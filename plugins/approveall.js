const fs = require('fs');
const path = require('path');
const { getSuccessWord, getActionEmoji } = require('../lib/funEmojis');

const DATA_FILE = path.join(__dirname, '../data/approveall.json');

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { approvedMembers: {} };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || { approvedMembers: {} };
  } catch (e) {
    return { approvedMembers: {} };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  command: 'approveall',
  aliases: ['approve-all', 'acceptall'],
  category: 'admin',
  description: 'Approve all members in the group',
  usage: '.approveall',
  groupOnly: true,
  adminOnly: true,
  cooldown: 3000,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const sender = message.key.participant || message.key.remoteJid;

    try {
      const metadata = await sock.groupMetadata(chatId);
      const participants = metadata.participants || [];
      const botJid = sock.user?.id || '';

      if (participants.length === 0) {
        await sock.sendMessage(chatId, {
          text: '❌ No participants found in this group.',
          ...channelInfo
        }, { quoted: message });
        return;
      }

      const data = readData();
      if (!data.approvedMembers) {
        data.approvedMembers = {};
      }

      if (!data.approvedMembers[chatId]) {
        data.approvedMembers[chatId] = [];
      }

      let approvedCount = 0;
      const participantJids = [];

      for (const participant of participants) {
        if (participant.id !== botJid && !data.approvedMembers[chatId].includes(participant.id)) {
          data.approvedMembers[chatId].push(participant.id);
          approvedCount++;
          participantJids.push(participant.id);
        }
      }

      writeData(data);

      const approveMessage = `${getActionEmoji('approve')} *Bulk Member Approval*\n\n${approvedCount} member(s) have been approved in this group.\n${getSuccessWord()}\n\n_Approved by: @${sender.split('@')[0]}_`;

      await sock.sendMessage(chatId, {
        text: approveMessage,
        mentions: [sender, ...participantJids].slice(0, 100), // WhatsApp limits mentions
        ...channelInfo
      });

    } catch (error) {
      console.error('Error in approveall command:', error);
      await sock.sendMessage(chatId, {
        text: `❌ Error: ${error.message}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
