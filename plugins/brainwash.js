module.exports = {
  command: 'brainwash',
  aliases: ['brainwashcheck'],
  category: 'fun',
  description: 'See how brainwashed someone is, in percent',
  usage: '.brainwash (reply/mention someone)',

  async handler(sock, message, args, context = {}) {
    const { chatId, channelInfo } = context;
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let target;

    if (mentioned && mentioned.length) {
      target = mentioned[0];
    } else if (quoted) {
      target = quoted.sender;
    } else {
      target = message.key.participant || message.key.remoteJid;
    }

    const percent = Math.floor(Math.random() * 101);
    const text = `🧠 *Brainwash Checker*
@${target.split('@')[0]} is *${percent}%* brainwashed!`;

    await sock.sendMessage(chatId, {
      text,
      mentions: [target],
      ...channelInfo
    }, { quoted: message });
  }
};
