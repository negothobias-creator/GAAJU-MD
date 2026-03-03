module.exports = {
  command: 'kickinactive',
  aliases: ['kickidle', 'kickinactiveusers'],
  category: 'admin',
  description: '(Stub) Kick users inactive for given days — not implemented.',
  usage: '.kickinactive <days>',
  groupOnly: true,
  adminOnly: true,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const days = parseInt(args[0], 10) || 0;

    if (!days || days <= 0) {
      await sock.sendMessage(chatId, { text: '❌ Usage: .kickinactive <days> — feature not implemented yet.' }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: `ℹ️ Kickinactive requested for ${days} day(s). This feature is not implemented.` }, { quoted: message });
  }
};
