const axios = require('axios');

module.exports = {
  command: 'kiss',
  aliases: [],
  category: 'fun',
  description: 'Send a kiss animation to someone',
  usage: '.kiss @user (or reply)',

  async handler(sock, message, args, context = {}) {
    const { chatId, channelInfo } = context;
    const sender = message.key.participant || message.key.remoteJid;

    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let target;

    if (mentioned && mentioned.length) {
      target = mentioned[0];
    } else if (quoted) {
      target = quoted.sender;
    }

    if (!target) {
      await sock.sendMessage(chatId, {
        text: '❌ Please mention someone or reply to their message to kiss them!',
        ...channelInfo
      }, { quoted: message });
      return;
    }

    try {
      const res = await axios.get('https://api.some-random-api.com/animu/kiss');
      const link = res.data?.link;
      if (link) {
        const caption = `@${sender.split('@')[0]} kisses @${target.split('@')[0]} 💋`;
        await sock.sendMessage(chatId, {
          image: { url: link },
          caption,
          mentions: [sender, target],
          ...channelInfo
        }, { quoted: message });
      } else {
        throw new Error('no link');
      }
    } catch (err) {
      console.error('Error in kiss command:', err);
      await sock.sendMessage(chatId, {
        text: '❌ Failed to fetch a kiss animation. Try again later!',
        ...channelInfo
      }, { quoted: message });
    }
  }
};
