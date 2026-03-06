const store = require('../lib/lightweight_store');
const fs = require('fs');
const path = require('path');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL);

async function loadAntichannelConfig(groupId) {
    try {
        if (HAS_DB) {
            const config = await store.getSetting(groupId, 'antichannel');
            return config || {};
        } else {
            const configPath = path.join(__dirname, '../data/userGroupData.json');
            if (!fs.existsSync(configPath)) {
                return {};
            }
            const data = JSON.parse(fs.readFileSync(configPath));
            return data.antichannel?.[groupId] || {};
        }
    } catch (error) {
        console.error('❌ Error loading antichannel config:', error.message);
        return {};
    }
}

async function setAntiChannel(chatId, enabled, action = 'warn') {
    try {
        await store.saveSetting(chatId, 'antichannel', {
            enabled: enabled,
            action: action
        });
        return true;
    } catch (error) {
        console.error('Error setting antichannel:', error);
        return false;
    }
}

async function getAntiChannel(chatId) {
    try {
        const settings = await store.getSetting(chatId, 'antichannel');
        return settings || null;
    } catch (error) {
        console.error('Error getting antichannel:', error);
        return null;
    }
}

async function incrementChannelWarningCount(chatId, userId) {
    try {
        const warningsKey = `antichannel_warnings`;
        let warnings = await store.getSetting(chatId, warningsKey) || {};
        
        if (!warnings[userId]) {
            warnings[userId] = 0;
        }
        warnings[userId]++;
        
        await store.saveSetting(chatId, warningsKey, warnings);
        return warnings[userId];
    } catch (error) {
        console.error('Error incrementing channel warning count:', error);
        return 0;
    }
}

async function resetChannelWarningCount(chatId, userId) {
    try {
        const warningsKey = `antichannel_warnings`;
        let warnings = await store.getSetting(chatId, warningsKey) || {};
        
        if (warnings[userId]) {
            delete warnings[userId];
            await store.saveSetting(chatId, warningsKey, warnings);
        }
        return true;
    } catch (error) {
        console.error('Error resetting channel warning count:', error);
        return false;
    }
}

async function handleAntiChannelCommand(sock, chatId, message, match) {
    if (!match) {
        const config = await getAntiChannel(chatId);
        const status = config?.enabled ? 'Enabled' : 'Disabled';
        const action = config?.action || 'warn';
        return sock.sendMessage(chatId, {
            text: `*ANTICHANNEL SETUP*\n\nStatus: ${status}\nAction: ${action}\n\n*.antichannel on*\nTurn on antichannel\n\n*.antichannel off*\nDisables antichannel in this group\n\n*.antichannel set <action>*\nSet action: warn/delete/kick\n\n*.antichannel reset*\nClear configuration and warnings\n\nStorage: ${HAS_DB ? 'Database' : 'File System'}`
        }, { quoted: message });
    }

    if (match === 'on') {
        const existingConfig = await getAntiChannel(chatId);
        if (existingConfig?.enabled) {
            return sock.sendMessage(chatId, { text: '*AntiChannel is already enabled for this group*' });
        }
        await setAntiChannel(chatId, true, 'warn');
        return sock.sendMessage(chatId, { text: '*AntiChannel has been enabled. Use .antichannel set <action> to customize action*' }, { quoted: message });
    }

    if (match === 'off') {
        const config = await getAntiChannel(chatId);
        if (!config?.enabled) {
            return sock.sendMessage(chatId, { text: '*AntiChannel is already disabled for this group*' }, { quoted: message } );
        }
        await setAntiChannel(chatId, false);
        return sock.sendMessage(chatId, { text: '*AntiChannel has been disabled for this group*' }, { quoted: message } );
    }
    
    if (match === 'reset') {
        // clear settings and warnings so the command can be re‑configured
        await setAntiChannel(chatId, false);
        try {
            await store.saveSetting(chatId, 'antichannel_warnings', {});
        } catch (_) {}
        return sock.sendMessage(chatId, { text: '*AntiChannel settings and warning counts have been reset for this group*' }, { quoted: message });
    }

    if (match.startsWith('set')) {
        const action = match.split(' ')[1];
        if (!action || !['warn', 'delete', 'kick'].includes(action)) {
            return sock.sendMessage(chatId, { text: '*Invalid action. Choose: warn, delete, or kick*' }, { quoted: message } );
        }
        await setAntiChannel(chatId, true, action);
        return sock.sendMessage(chatId, { text: `*AntiChannel action set to: ${action}*` }, { quoted: message } );
    }

    return sock.sendMessage(chatId, { text: '*Invalid command. Use .antichannel to see usage*' }, { quoted: message } );
}

async function handleChannelDetection(sock, chatId, message, userMessage, senderId) {
    const config = await loadAntichannelConfig(chatId);
    if (!config.enabled) return;

    if (!chatId.endsWith('@g.us')) return;

    if (message.key.fromMe) return;

    const antiChannelConfig = await getAntiChannel(chatId);
    if (!antiChannelConfig?.enabled) {
        return;
    }

    // Detect channel posts: messages containing channel links or mentions
    const channelPatterns = [
        /https?:\/\/(www\.)?whatsapp\.com\/channel\//i,
        /@channel/i,
        /whatsapp.*channel/i
    ];

    let containsChannel = false;
    for (const pattern of channelPatterns) {
        if (pattern.test(userMessage)) {
            containsChannel = true;
            break;
        }
    }

    if (!containsChannel) return;

    const warningCount = await incrementChannelWarningCount(chatId, senderId);

    if (warningCount < 2) {
        // Warn
        await sock.sendMessage(chatId, {
            text: `⚠️ *Warning ${warningCount}/2*\n\n@${senderId.split('@')[0]}, posting channel links is not allowed in this group!\n\nNext violation will result in action.`,
            mentions: [senderId]
        }, { quoted: message });
    } else {
        // Action after 2 warnings
        const action = antiChannelConfig.action || 'warn';
        if (action === 'delete') {
            await sock.sendMessage(chatId, { delete: message.key });
            await resetChannelWarningCount(chatId, senderId);
        } else if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 @${senderId.split('@')[0]} has been removed for posting channel links.`,
                    mentions: [senderId]
                });
                await resetChannelWarningCount(chatId, senderId);
            } catch (error) {
                console.error('Error kicking user:', error);
            }
        } else {
            // Default warn, but since count >=2, perhaps kick or delete
            await sock.sendMessage(chatId, {
                text: `🚫 @${senderId.split('@')[0]}, final warning! Posting channel links is prohibited.`,
                mentions: [senderId]
            }, { quoted: message });
            // Reset or keep?
        }
    }
}

module.exports = {
  command: 'antichannel',
  aliases: ['achannel', 'antich'],
  category: 'group',
  description: 'Manage anti-channel behavior',
  usage: '.antichannel <on|off|status|set action|reset>',

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const sub = (args[0] || '').toLowerCase();

    if (!sub || sub === 'status') {
      await handleAntiChannelCommand(sock, chatId, message, '');
      return;
    }

    if (sub === 'on' || sub === 'off' || sub === 'reset' || sub.startsWith('set')) {
      await handleAntiChannelCommand(sock, chatId, message, sub + (args[1] ? ' ' + args[1] : ''));
      return;
    }

    await sock.sendMessage(chatId, { text: '❌ Usage: .antichannel <on|off|status|set action>' }, { quoted: message });
  }
};

module.exports.handleChannelDetection = handleChannelDetection;
