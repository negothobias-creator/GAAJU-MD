const { guessLetter } = require('./hangman');

module.exports = {
    command: 'guess',
    aliases: ['g'],
    category: 'games',
    description: 'Guess a letter in hangman game',
    usage: '.guess <letter>',
    groupOnly: true,
    cooldown: 2000,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const letter = args[0]?.toLowerCase();

        if (!letter || letter.length !== 1 || !/[a-z]/.test(letter)) {
            await sock.sendMessage(chatId, {
                text: '❌ *Invalid guess*\n\nPlease provide a single letter (a-z).\n\nExample: `.guess a`'
            }, { quoted: message });
            return;
        }

        guessLetter(sock, chatId, letter);
    }
};