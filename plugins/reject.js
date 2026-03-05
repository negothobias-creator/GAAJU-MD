const { getErrorWord, getActionEmoji } = require('../lib/funEmojis');

module.exports = {
  command: 'reject',
  aliases: ['decline', 'deny'],
  category: 'admin',
  description: 'Reject a member (respond to member by admin/sudo)',
  usage: '.reject @user <reason>',
  groupOnly: true,
  adminOnly: true,
  cooldown: 1000,

  async handler(sock, message, args, context = {}) {
    const { chatId, senderIsOwnerOrSudo } = context;
    const channelInfo = context.channelInfo || {};
    const sender = message.key.participant || message.key.remoteJid;

    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;
    let target = null;

    if (mentioned && mentioned.length) {
      target = mentioned[0];
    } else if (quotedParticipant) {
      target = quotedParticipant;
    }

    if (!target) {
      await sock.sendMessage(chatId, {
        text: '❌ Please mention a member or reply to their message to reject them!'
      }, { quoted: message });
      return;
    }

    const reason = args.slice().join(' ') || 'Your request has been rejected.';

    const rejectMessage = `${getActionEmoji('reject')} *Rejection Notice*\n\n@${target.split('@')[0]}, your request has been rejected.\n\n*Reason:* ${reason}\n${getErrorWord()}\n\n_Rejected by: @${sender.split('@')[0]}_`;

    try {
      await sock.sendMessage(chatId, {
        text: rejectMessage,
        mentions: [target, sender],
        ...channelInfo
      });
    } catch (error) {
      console.error('Error in reject command:', error);
      await sock.sendMessage(chatId, {
        text: 'Failed to send rejection message.',
        ...channelInfo
      }, { quoted: message });
    }
  }
};
