const owners = require('../data/owner.json');

module.exports = {
  command: 'pregnancycheck',
  aliases: ['pregnancy','pregcheck'],
  category: 'fun',
  description: 'Random pregnancy chance for a user',
  usage: '.pregnancycheck (reply/mention someone)',

  async handler(sock, message, args, context = {}) {
    const { chatId } = context;
    const channelInfo = context.channelInfo || {};
    const ownerJids = (owners || []).map(n => n.includes('@') ? n : `${n}@s.whatsapp.net`);
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;
    const sender = message.key.participant || message.key.remoteJid;
    let target = null;

    if (mentioned && mentioned.length) target = mentioned[0];
    else if (quotedParticipant) target = quotedParticipant;
    else {
      await sock.sendMessage(chatId, { text: '❌ Please mention someone or reply to their message.' }, { quoted: message });
      return;
    }

    if (target === sender) {
      await sock.sendMessage(chatId, { text: '❌ You cannot use this command on yourself.' }, { quoted: message });
      return;
    }

    if (ownerJids.includes(target)) {
      await sock.sendMessage(chatId, { text: '❌ This action cannot be performed on the bot owner.' }, { quoted: message });
      return;
    }

    const percent = Math.floor(Math.random() * 101);
    const text = `🤰 *Pregnancy Checker*\n@${target.split('@')[0]} is *${percent}%* pregnant!`;

    await sock.sendMessage(chatId, {
      text,
      mentions: [target],
      ...channelInfo
    }, { quoted: message });
  }
};
