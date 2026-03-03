const isAdmin = require('../lib/isAdmin');

module.exports = {
  command: 'kickall',
  aliases: ['kickeveryone', 'kickallnow'],
  category: 'admin',
  description: 'Kick all non-admin members from the group (use with caution).',
  usage: '.kickall',
  groupOnly: true,
  adminOnly: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;

    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, sender);

    if (!isSenderAdmin) {
      await sock.sendMessage(chatId, { text: '❌ You must be a group admin to use this command.' }, { quoted: message });
      return;
    }

    if (!isBotAdmin) {
      await sock.sendMessage(chatId, { text: '❌ I need to be an admin to remove members.' }, { quoted: message });
      return;
    }

    try {
      const metadata = await sock.groupMetadata(chatId);
      const participants = metadata.participants || [];

      const botId = sock.user?.id || '';
      const botLid = sock.user?.lid || '';

      const toKick = participants.filter(p => {
        const isAdminFlag = p.admin === 'admin' || p.admin === 'superadmin';
        const jid = p.id || p.lid || p.phoneNumber || '';
        // don't kick admins or the bot itself
        const isBot = (jid === botId || jid === botLid || jid.includes(botId.split('@')[0] || ''));
        return !isAdminFlag && !isBot;
      }).map(p => p.id || p.lid || p.phoneNumber).filter(Boolean);

      if (toKick.length === 0) {
        await sock.sendMessage(chatId, { text: 'ℹ️ No non-admin members to remove.' }, { quoted: message });
        return;
      }

      // remove in chunks (if necessary)
      await sock.groupParticipantsUpdate(chatId, toKick, 'remove');

      const mentions = toKick.map(j => j);
      await sock.sendMessage(chatId, { text: `🚫 Removed ${toKick.length} member(s).`, mentions }, { quoted: message });
    } catch (err) {
      console.error('kickall error:', err);
      await sock.sendMessage(chatId, { text: '❌ Failed to remove members. Check bot permissions.' }, { quoted: message });
    }
  }
};
