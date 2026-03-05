const fetch = require('node-fetch');

const localTruths = [
  "What's your biggest fear?",
  "Have you ever cheated on a test?",
  "What's the most embarrassing thing you've done?",
  "Who was your first crush?",
  "What's a secret you've never told anyone?",
  "Have you ever lied to your parents?",
  "What's your guilty pleasure?",
  "Have you ever stolen something?",
  "What's the worst grade you've ever gotten?",
  "Have you ever been in trouble with the law?",
  "What's something you're terrible at?",
  "Have you ever had a crush on a teacher?",
  "What's the most childish thing you still do?",
  "Have you ever faked being sick to skip school/work?",
  "What's your most embarrassing nickname?",
  "Have you ever sent a nude photo?",
  "What's the weirdest dream you've had?",
  "Have you ever been caught talking to yourself?",
  "What's something you regret doing?",
  "Have you ever eavesdropped on a conversation?"
];

module.exports = {
  command: 'truth',
  aliases: ['truthdare'],
  category: 'games',
  description: 'Get a random truth from the Shizo API.',
  usage: '.truth',
  groupOnly: true,
  cooldown: 5000,
  
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;

    try {
      const shizokeys = 'shizo';
      const res = await fetch(`https://shizoapi.onrender.com/api/texts/truth?apikey=${shizokeys}`);
      if (!res.ok) {
        throw await res.text();
      }
      const json = await res.json();
      const truthMessage = json.result;
      
      await sock.sendMessage(chatId, { 
        text: truthMessage 
      }, { quoted: message });
    } catch (error) {
      console.error('Error in truth command:', error);
      // Fallback to local truth
      const localTruth = localTruths[Math.floor(Math.random() * localTruths.length)];
      await sock.sendMessage(chatId, { 
        text: `🤔 *Truth:* ${localTruth}\n\n_(Using local fallback due to API issues)_`
      }, { quoted: message });
    }
  }
};
