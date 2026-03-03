const owners = require('../data/owner.json');

module.exports = {
  command: 'left',
  aliases: ['leave', 'leftchat'],
  category: 'general',
  description: 'Make the bot leave the current group (no event recording).',
  usage: '.left',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;
    const isGroup = (chatId || '').endsWith('@g.us');

    if (!isGroup) {
      await sock.sendMessage(chatId, { text: '❌ This command can only be used inside a group to ask the bot to leave.' }, { quoted: message });
      return;
    }

    try {
      if (typeof sock.groupLeave === 'function') {
        await sock.groupLeave(chatId);
      } else {
        // notify owners to remove the bot from the group
        const ownerJids = (owners || []).map(n => n.includes('@') ? n : `${n}@s.whatsapp.net`);
        const notifyText = `📩 Leave request\nRequester: @${sender.split('@')[0]}\nGroup: ${chatId}`;
        for (const owner of ownerJids) {
          await sock.sendMessage(owner, { text: notifyText, mentions: [sender] });
        }
        await sock.sendMessage(chatId, { text: '✅ Requested the bot owner(s) to remove me from this group.' }, { quoted: message });
      }
    } catch (err) {
      console.error('left plugin error:', err);
      await sock.sendMessage(chatId, { text: '❌ Failed to leave the group.' }, { quoted: message });
    }
  }
};
