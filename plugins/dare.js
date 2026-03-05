const fetch = require('node-fetch');

const localDares = [
  "Sing a song loudly in front of everyone.",
  "Do 10 push-ups right now.",
  "Call a random contact and say 'I love you'.",
  "Dance like nobody's watching for 30 seconds.",
  "Tell everyone your most embarrassing moment.",
  "Eat a spoonful of hot sauce.",
  "Speak in a different accent for the next 5 minutes.",
  "Let someone draw on your face with a marker.",
  "Do your best impression of a celebrity.",
  "Wear your clothes inside out for an hour.",
  "Text your crush and say 'I miss you'.",
  "Post an embarrassing photo on your story.",
  "Let the group choose your next profile picture.",
  "Do a cartwheel (or attempt one).",
  "Tell a joke that makes everyone laugh.",
  "Give someone in the group a compliment.",
  "Do 20 jumping jacks.",
  "Speak only in rhymes for the next 10 minutes.",
  "Let someone tickle you for 30 seconds.",
  "Share your phone's wallpaper with the group."
];

module.exports = {
  command: 'dare',
  aliases: ['truthordare', 'challenge'],
  category: 'games',
  description: 'Get a random dare',
  usage: '.dare',
  groupOnly: true,
  cooldown: 5000,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    try {
      const shizokeys = 'shizo';
      const res = await fetch(
        `https://shizoapi.onrender.com/api/texts/dare?apikey=${shizokeys}`
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const json = await res.json();
      const dareMessage = json.result;

      await sock.sendMessage(chatId, {
        text: dareMessage
      }, { quoted: message });

    } catch (error) {
      console.error('Error in dare command:', error);
      // Fallback to local dare
      const localDare = localDares[Math.floor(Math.random() * localDares.length)];
      await sock.sendMessage(chatId, {
        text: `🎯 *Dare:* ${localDare}\n\n_(Using local fallback due to API issues)_`
      }, { quoted: message });
    }
  }
};
