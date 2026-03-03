module.exports = {
  command: 'autoreply',
  aliases: ['areply'],
  category: 'general',
  description: 'Toggle or configure autoreply (stub).',
  usage: '.autoreply <on|off|status>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'status') {
      await sock.sendMessage(chatId, { text: 'ℹ️ Autoreply: Not configured. Use `.autoreply on` or `.autoreply off`.' }, { quoted: message });
      return;
    }

    if (sub === 'on' || sub === 'off') {
      await sock.sendMessage(chatId, { text: `✅ Autoreply set to: ${sub}` }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: '❌ Usage: .autoreply <on|off|status>' }, { quoted: message });
  }
};
