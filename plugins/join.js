const owners = require('../data/owner.json');

module.exports = {
  command: 'join',
  aliases: [],
  category: 'general',
  description: 'Request the bot to join a group (not record events).',
  usage: '.join <invite link or group id>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;
    const invite = args.join(' ').trim() || null;

    const ownerJids = (owners || []).map(n => n.includes('@') ? n : `${n}@s.whatsapp.net`);

    if (!invite) {
      await sock.sendMessage(chatId, { text: '❌ Please provide a group invite link or group id to request the bot to join.' }, { quoted: message });
      return;
    }

    const notifyText = `📩 Join request\nRequester: @${sender.split('@')[0]}\nInvite: ${invite}`;

    try {
      for (const owner of ownerJids) {
        await sock.sendMessage(owner, { text: notifyText, mentions: [sender] });
      }
      await sock.sendMessage(chatId, { text: '✅ Join request sent to the bot owner(s). They will add me if approved.' }, { quoted: message });
    } catch (err) {
      console.error('join plugin error:', err);
      await sock.sendMessage(chatId, { text: '❌ Failed to send join request to owner(s).' }, { quoted: message });
    }
  }
};
