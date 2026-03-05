const store = require('../lib/lightweight_store');
const fs = require('fs');
const path = require('path');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL);

async function loadAntiAdvertiseConfig(groupId) {
    try {
        if (HAS_DB) {
            const config = await store.getSetting(groupId, 'antiadvertise');
            return config || {};
        } else {
            const configPath = path.join(__dirname, '../data/userGroupData.json');
            if (!fs.existsSync(configPath)) {
                return {};
            }
            const data = JSON.parse(fs.readFileSync(configPath));
            return data.antiadvertise?.[groupId] || {};
        }
    } catch (error) {
        console.error('❌ Error loading antiadvertise config:', error.message);
        return {};
    }
}

async function setAntiAdvertise(chatId, enabled) {
    try {
        await store.saveSetting(chatId, 'antiadvertise', {
            enabled: enabled
        });
        return true;
    } catch (error) {
        console.error('Error setting antiadvertise:', error);
        return false;
    }
}

async function getAntiAdvertise(chatId) {
    try {
        const settings = await store.getSetting(chatId, 'antiadvertise');
        return settings || null;
    } catch (error) {
        console.error('Error getting antiadvertise:', error);
        return null;
    }
}

async function handleAntiAdvertiseCommand(sock, chatId, message, match) {
    if (!match) {
        const config = await getAntiAdvertise(chatId);
        const status = config?.enabled ? 'Enabled' : 'Disabled';
        return sock.sendMessage(chatId, {
            text: `*ANTIADVERTISE SETUP*\n\nStatus: ${status}\n\n*.antiadvertise on*\nTurn on antiadvertise\n\n*.antiadvertise off*\nDisables antiadvertise in this group\n\nStorage: ${HAS_DB ? 'Database' : 'File System'}`
        }, { quoted: message });
    }

    if (match === 'on') {
        const existingConfig = await getAntiAdvertise(chatId);
        if (existingConfig?.enabled) {
            return sock.sendMessage(chatId, { text: '*AntiAdvertise is already enabled for this group*' });
        }
        await setAntiAdvertise(chatId, true);
        return sock.sendMessage(chatId, { text: '*AntiAdvertise has been enabled. Messages with links or promotional content will be deleted immediately*' }, { quoted: message });
    }

    if (match === 'off') {
        const config = await getAntiAdvertise(chatId);
        if (!config?.enabled) {
            return sock.sendMessage(chatId, { text: '*AntiAdvertise is already disabled for this group*' }, { quoted: message } );
        }
        await setAntiAdvertise(chatId, false);
        return sock.sendMessage(chatId, { text: '*AntiAdvertise has been disabled for this group*' }, { quoted: message } );
    }

    return sock.sendMessage(chatId, { text: '*Invalid command. Use .antiadvertise to see usage*' }, { quoted: message } );
}

function containsLink(text) {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    return urlRegex.test(text);
}

function containsAdKeywords(text) {
    const adKeywords = [
        'buy', 'sell', 'purchase', 'discount', 'promo', 'offer', 'deal', 'cheap', 'price',
        'advertise', 'ad', 'marketing', 'product', 'service', 'shop', 'store', 'website',
        'click here', 'visit', 'check out', 'order now', 'limited time', 'sale'
    ];
    const lowerText = text.toLowerCase();
    return adKeywords.some(keyword => lowerText.includes(keyword));
}

async function handleAdvertiseDetection(sock, chatId, message, userMessage, senderId) {
    const config = await loadAntiAdvertiseConfig(chatId);
    if (!config.enabled) return;

    if (!chatId.endsWith('@g.us')) return;

    if (message.key.fromMe) return;

    const antiAdvertiseConfig = await getAntiAdvertise(chatId);
    if (!antiAdvertiseConfig?.enabled) {
        return;
    }

    let shouldDelete = false;

    // Check text message for links or ad keywords
    if (userMessage && (containsLink(userMessage) || containsAdKeywords(userMessage))) {
        shouldDelete = true;
    }

    // Check media captions for links or ad keywords
    const messageObj = message.message;
    if (messageObj) {
        const mediaTypes = ['imageMessage', 'videoMessage', 'documentMessage'];
        for (const type of mediaTypes) {
            if (messageObj[type]?.caption) {
                const caption = messageObj[type].caption.toLowerCase();
                if (containsLink(caption) || containsAdKeywords(caption)) {
                    shouldDelete = true;
                    break;
                }
            }
        }
    }

    if (shouldDelete) {
        try {
            await sock.sendMessage(chatId, { delete: message.key });
            console.log(`🚫 Advertisement deleted from ${senderId.split('@')[0]}`);
        } catch (error) {
            console.error('Error deleting advertise message:', error);
        }
    }
}

module.exports = {
  command: 'antiadvertise',
  aliases: ['antiad', 'noad'],
  category: 'group',
  description: 'Prevent advertising via links, pictures, or promotional content',
  usage: '.antiadvertise <on|off|status>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'status') {
      await handleAntiAdvertiseCommand(sock, chatId, message, '');
      return;
    }

    if (sub === 'on' || sub === 'off') {
      await handleAntiAdvertiseCommand(sock, chatId, message, sub);
      return;
    }

    await sock.sendMessage(chatId, { text: '❌ Usage: .antiadvertise <on|off|status>' }, { quoted: message });
  }
};

module.exports.handleAdvertiseDetection = handleAdvertiseDetection;