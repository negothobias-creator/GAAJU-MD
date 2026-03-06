
const fs = require('fs');
const store = require('./lightweight_store');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);
const bannedFilePath = './data/banned.json';

async function isBanned(userId) {
    try {
        // never consider the bot itself as banned
        const botId = global.botId || process.env.BOT_ID || '';
        if (botId && userId === botId) return false;

        if (HAS_DB) {
            let banned = await store.getSetting('global', 'banned');
            banned = banned || [];
            // if protection enabled, make sure bot not in set
            try {
                const protect = await store.getSetting('global', 'banProtect');
                if (protect && protect.enabled && botId) {
                    if (banned.includes(botId)) {
                        banned = banned.filter(u => u !== botId);
                        await store.saveSetting('global', 'banned', banned);
                    }
                }
            } catch {};
            return banned.includes(userId);
        } else {
            if (!fs.existsSync(bannedFilePath)) {
                return false;
            }
            let bannedUsers = JSON.parse(fs.readFileSync(bannedFilePath, 'utf8'));
            // clean bot id if needed
            try {
                const protectData = await store.getSetting('global', 'banProtect');
                if (protectData && protectData.enabled && botId) {
                    if (bannedUsers.includes(botId)) {
                        bannedUsers = bannedUsers.filter(u => u !== botId);
                        fs.writeFileSync(bannedFilePath, JSON.stringify(bannedUsers, null, 2));
                    }
                }
            } catch (e) {}
            return bannedUsers.includes(userId);
        }
    } catch (error) {
        console.error('Error checking banned status:', error);
        return false;
    }
}

module.exports = { isBanned };

