module.exports = {
  command: 'antichannel',
  aliases: ['achannel', 'antich'],
  category: 'group',
  description: 'Manage anti-channel behavior (stub).',
  usage: '.antichannel <on|off|status>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = (args[0] || '').toLowerCase();

    if (!sub || ['status'].includes(sub)) {
      await sock.sendMessage(chatId, { text: 'ℹ️ Anti-channel: Not configured. Use `.antichannel on` or `.antichannel off`.' }, { quoted: message });
      return;
    }

    if (sub === 'on' || sub === 'off') {
      await sock.sendMessage(chatId, { text: `✅ Anti-channel set to: ${sub}` }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: '❌ Usage: .antichannel <on|off|status>' }, { quoted: message });
  }
};
