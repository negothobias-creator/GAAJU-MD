const { getErrorWord, getActionEmoji } = require('../lib/funEmojis');

module.exports = {
  command: 'rejectall',
  aliases: ['rejecteveryone', 'declineall'],
  category: 'admin',
  description: 'Reject all members in the group (admin/sudo only)',
  usage: '.rejectall <reason>',
  groupOnly: true,
  adminOnly: true,
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const { chatId, senderIsOwnerOrSudo } = context;
    const channelInfo = context.channelInfo || {};
    const sender = message.key.participant || message.key.remoteJid;

    const reason = args.join(' ') || 'All requests have been rejected.';

    try {
      const metadata = await sock.groupMetadata(chatId);
      const participants = metadata.participants || [];
      const senderPhoneNumber = sender.split('@')[0];
      const botId = sock.user?.id || '';

      if (participants.length === 0) {
        await sock.sendMessage(chatId, {
          text: '❌ No participants found in this group.',
          ...channelInfo
        }, { quoted: message });
        return;
      }

      const rejectMessage = `${getActionEmoji('reject')} *Global Rejection Notice*\n\nAll members' requests have been rejected.\n\n*Reason:* ${reason}\n${getErrorWord()}\n\n_Rejected by: @${senderPhoneNumber}_\n\nℹ️ This is a group-wide announcement.`;

      await sock.sendMessage(chatId, {
        text: rejectMessage,
        mentions: [sender],
        ...channelInfo
      });

    } catch (error) {
      console.error('Error in rejectall command:', error);
      await sock.sendMessage(chatId, {
        text: `❌ Error executing rejectall command: ${error.message}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
