const store = require('../lib/lightweight_store');

module.exports = {
  command: 'banprotect',
  aliases: ['protectbot', 'antiban'],
  category: 'owner',
  description: 'Toggle protection against banning the bot account',
  usage: '.banprotect on|off|status',
  ownerOnly: true,
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const { chatId, channelInfo } = context;
    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'status') {
      const cfg = await store.getSetting('global', 'banProtect') || {};
      const enabled = cfg.enabled === true;
      await sock.sendMessage(chatId, {
        text: `🛡️ *Ban Protection Status*\n\nStatus: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}\n\nUse .banprotect on/off to toggle.`,
        ...channelInfo
      }, { quoted: message });
      return;
    }

    if (sub === 'on' || sub === 'enable') {
      await store.saveSetting(chatId, 'banProtect', { enabled: true });
      await sock.sendMessage(chatId, { text: '✅ Bot ban protection is now *ENABLED*', ...channelInfo }, { quoted: message });
      return;
    }

    if (sub === 'off' || sub === 'disable') {
      await store.saveSetting(chatId, 'banProtect', { enabled: false });
      await sock.sendMessage(chatId, { text: '⚠️ Bot ban protection is now *DISABLED*', ...channelInfo }, { quoted: message });
      return;
    }

    await sock.sendMessage(chatId, { text: '❌ Usage: .banprotect on|off|status', ...channelInfo }, { quoted: message });
  }
};
