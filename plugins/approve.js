const fs = require('fs');
const path = require('path');
const { getSuccessWord, getActionEmoji } = require('../lib/funEmojis');

const DATA_FILE = path.join(__dirname, '../data/approve.json');

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
  command: 'approve',
  aliases: ['acceptmember', 'confirmmember'],
  category: 'admin',
  description: 'Approve a member to join the group',
  usage: '.approve @user or reply',
  groupOnly: true,
  adminOnly: true,
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;
    let target = null;

    if (mentioned.length) {
      target = mentioned[0];
    } else if (quotedParticipant) {
      target = quotedParticipant;
    } else if (args[0]) {
      target = args[0].includes('@') ? args[0] : `${args[0]}@s.whatsapp.net`;
    }

    if (!target) {
      await sock.sendMessage(chatId, {
        text: '❌ Please mention a member or reply to approve them!'
      }, { quoted: message });
      return;
    }

    try {
      const metadata = await sock.groupMetadata(chatId);
      const participants = metadata.participants || [];
      const targetExists = participants.some(p => p.id === target);

      if (!targetExists) {
        await sock.sendMessage(chatId, {
          text: '❌ This user is not in the group yet.',
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

      if (!data.approvedMembers[chatId].includes(target)) {
        data.approvedMembers[chatId].push(target);
        writeData(data);

        const approveMessage = `${getActionEmoji('approve')} *Member Approved*\n\n@${target.split('@')[0]} has been approved in this group.\n${getSuccessWord()}`;
        
        await sock.sendMessage(chatId, {
          text: approveMessage,
          mentions: [target],
          ...channelInfo
        });
      } else {
        await sock.sendMessage(chatId, {
          text: `ℹ️ @${target.split('@')[0]} is already approved.`,
          mentions: [target],
          ...channelInfo
        }, { quoted: message });
      }
    } catch (error) {
      console.error('Error in approve command:', error);
      await sock.sendMessage(chatId, {
        text: `❌ Error: ${error.message}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
