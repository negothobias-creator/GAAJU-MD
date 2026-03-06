const fs = require('fs');
const store = require('../lib/lightweight_store');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);


const bannedFilePath = './data/banned.json';

async function getBannedUsers() {
    let list = [];

    if (HAS_DB) {
        const banned = await store.getSetting('global', 'banned');
        list = banned || [];
    } else {
        if (fs.existsSync(bannedFilePath)) {
            list = JSON.parse(fs.readFileSync(bannedFilePath));
        }
    }

    // remove bot id if protection enabled
    try {
        const protect = await store.getSetting('global', 'banProtect');
        const botId = global.botId || process.env.BOT_ID || '';
        if (protect && protect.enabled && botId) {
            list = list.filter(u => u !== botId);
        }
    } catch (e) {
        // ignore
    }

    return list;
}

async function saveBannedUsers(bannedUsers) {
    // if protection is on, make sure botId never gets added
    try {
        const protect = await store.getSetting('global', 'banProtect');
        const botId = global.botId || process.env.BOT_ID || '';
        if (protect && protect.enabled && botId) {
            bannedUsers = bannedUsers.filter(u => u !== botId);
        }
    } catch (e) {}

    if (HAS_DB) {
        await store.saveSetting('global', 'banned', bannedUsers);
    } else {
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }
        fs.writeFileSync(bannedFilePath, JSON.stringify(bannedUsers, null, 2));
    }
}

async function isUserBanned(userId) {
    const bannedUsers = await getBannedUsers();
    return bannedUsers.includes(userId);
}

module.exports = {
    command: 'ban',
    aliases: ['block', 'banuser'],
    category: 'group',
    description: 'Ban a user from using the bot',
    usage: '.ban @user or reply to message',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};
        const isGroup = context.isGroup;

        let userToBan;
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToBan = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToBan = message.message.extendedTextMessage.contextInfo.participant;
        }
        
        if (!userToBan) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Please mention a user or reply to their message*\n\nUsage: `.ban @user` or reply with `.ban`',
                ...channelInfo 
            }, { quoted: message });
            return;
        }

        try {
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            if (userToBan === botId || userToBan === botId.replace('@s.whatsapp.net', '@lid')) {
                await sock.sendMessage(chatId, { 
                    text: '❌ *Cannot ban the bot account*',
                    ...channelInfo 
                }, { quoted: message });
                return;
            }
        } catch (e) {}

        try {
            let bannedUsers = await getBannedUsers();
            
            if (!bannedUsers.includes(userToBan)) {
                bannedUsers.push(userToBan);
                await saveBannedUsers(bannedUsers);
                
                await sock.sendMessage(chatId, { 
                    text: `🚫 *User Banned Successfully!*\n\n@${userToBan.split('@')[0]} has been banned from using the bot.\n\n` +
                          `*Storage:* ${HAS_DB ? 'Database' : 'File System'}`,
                    mentions: [userToBan],
                    ...channelInfo 
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { 
                    text: `⚠️ *Already Banned*\n\n@${userToBan.split('@')[0]} is already banned!`,
                    mentions: [userToBan],
                    ...channelInfo 
                }, { quoted: message });
            }
        } catch (error) {
            console.error('Error in ban command:', error);
            await sock.sendMessage(chatId, { 
                text: '❌ *Failed to ban user!*\n\nPlease try again.',
                ...channelInfo 
            }, { quoted: message });
        }
    }
};

module.exports.getBannedUsers = getBannedUsers;
module.exports.saveBannedUsers = saveBannedUsers;
module.exports.isUserBanned = isUserBanned;
