const axios = require('axios');
const { getGreeting, getSuccessWord } = require('../lib/funEmojis');

module.exports = {
  command: 'hug',
  aliases: ['cuddle', 'embrace'],
  category: 'fun',
  description: 'Send a hug to someone',
  usage: '.hug @user (or reply)',
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const { chatId } = context;
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
        text: '❌ Please mention someone or reply to their message to send them a hug!'
      }, { quoted: message });
      return;
    }

    if (target === sender) {
      await sock.sendMessage(chatId, {
        text: '🤗 You deserve a hug too! Here\'s one for you. *Hug!* 💙'
      }, { quoted: message });
      return;
    }

    try {
      const res = await axios.get('https://api.waifu.pics/sfw/hug');
      const link = res.data?.url || res.data?.link;
      
      if (link) {
        const caption = `@${sender.split('@')[0]} sends a warm hug to @${target.split('@')[0]} 🤗💙\n${getSuccessWord()}`;
        await sock.sendMessage(chatId, {
          image: { url: link },
          caption,
          mentions: [sender, target],
          ...channelInfo
        }, { quoted: message });
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('Error in hug command:', error);
      await sock.sendMessage(chatId, {
        text: `🤗 @${sender.split('@')[0]} sends a warm hug to @${target.split('@')[0]}! 💙\n${getGreeting()}`,
        mentions: [sender, target],
        ...channelInfo
      }, { quoted: message });
    }
  }
};
