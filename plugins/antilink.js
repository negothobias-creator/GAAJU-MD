const store = require('../lib/lightweight_store');
const isOwnerOrSudo = require('../lib/isOwner');
const isAdmin = require('../lib/isAdmin');
const fs = require('fs');
const path = require('path');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const databaseDir = path.join(process.cwd(), 'data');
const antilinkWarningsPath = path.join(databaseDir, 'antilinkWarnings.json');

// Initialize warnings file
function initializeWarningsFile() {
  if (!HAS_DB) {
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    
    if (!fs.existsSync(antilinkWarningsPath)) {
      fs.writeFileSync(antilinkWarningsPath, JSON.stringify({}), 'utf8');
    }
  }
}

// Get antilink warnings
async function getAntilinkWarnings() {
  if (HAS_DB) {
    const warnings = await store.getSetting('global', 'antilinkWarnings');
    return warnings || {};
  } else {
    try {
      initializeWarningsFile();
      return JSON.parse(fs.readFileSync(antilinkWarningsPath, 'utf8'));
    } catch (error) {
      return {};
    }
  }
}

// Save antilink warnings
async function saveAntilinkWarnings(warnings) {
  if (HAS_DB) {
    await store.saveSetting('global', 'antilinkWarnings', warnings);
  } else {
    initializeWarningsFile();
    fs.writeFileSync(antilinkWarningsPath, JSON.stringify(warnings, null, 2));
  }
}

async function setAntilink(chatId, type, action) {
    try {
        await store.saveSetting(chatId, 'antilink', {
            enabled: true,
            action: action,
            type: type
        });
        return true;
    } catch (error) {
        console.error('Error setting antilink:', error);
        return false;
    }
}

async function getAntilink(chatId, type) {
    try {
        const settings = await store.getSetting(chatId, 'antilink');
        return settings || null;
    } catch (error) {
        console.error('Error getting antilink:', error);
        return null;
    }
}

async function removeAntilink(chatId, type) {
    try {
        await store.saveSetting(chatId, 'antilink', {
            enabled: false,
            action: null,
            type: null
        });
        return true;
    } catch (error) {
        console.error('Error removing antilink:', error);
        return false;
    }
}

async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        const config = await getAntilink(chatId, 'on');
        if (!config?.enabled) return;

        // Check if sender is owner or sudo
        const isOwnerSudo = await isOwnerOrSudo(senderId, sock, chatId);
        if (isOwnerSudo) return;

        // Check if sender is admin
        try {
            const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
            if (isSenderAdmin) return;
        } catch (e) {}

        const action = config.action || 'warn';
        let shouldAct = false;
        let linkType = '';

        const linkPatterns = {
            whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i,
            whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/i,
            telegram: /t\.me\/[A-Za-z0-9_]+/i,
            allLinks: /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i,
        };

        if (linkPatterns.whatsappGroup.test(userMessage)) {
            shouldAct = true;
            linkType = 'WhatsApp Group';
        } else if (linkPatterns.whatsappChannel.test(userMessage)) {
            shouldAct = true;
            linkType = 'WhatsApp Channel';
        } else if (linkPatterns.telegram.test(userMessage)) {
            shouldAct = true;
            linkType = 'Telegram';
        } else if (linkPatterns.allLinks.test(userMessage)) {
            shouldAct = true;
            linkType = 'Link';
        }

        if (!shouldAct) return;

        const messageId = message.key.id;
        const participant = message.key.participant || senderId;

        // Delete the message
        if (action === 'delete' || action === 'warn' || action === 'kick') {
            try {
                await sock.sendMessage(chatId, {
                    delete: { 
                        remoteJid: chatId, 
                        fromMe: false, 
                        id: messageId, 
                        participant: participant 
                    }
                });
            } catch (error) {
                console.error('Failed to delete message:', error);
            }
        }

        // Get current warnings
        let warnings = await getAntilinkWarnings();
        if (!warnings[chatId]) warnings[chatId] = {};
        if (!warnings[chatId][senderId]) warnings[chatId][senderId] = 0;

        warnings[chatId][senderId]++;
        const currentWarnings = warnings[chatId][senderId];
        await saveAntilinkWarnings(warnings);

        // Tag user and send warning message
        const warningText = `@${senderId.split('@')[0]} ${linkType.toLowerCase()} links not allowed\n\n⚠️ *Warning: ${currentWarnings}/3*`;

        await sock.sendMessage(chatId, {
            text: warningText,
            mentions: [senderId]
        });

        // Check if user should be kicked (3 warnings)
        if (currentWarnings >= 3) {
            try {
                await new Promise(resolve => setTimeout(resolve, 500));
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                
                // Clear warnings for this user
                delete warnings[chatId][senderId];
                await saveAntilinkWarnings(warnings);

                await sock.sendMessage(chatId, {
                    text: `🚫 *Auto-Removed*\n\n@${senderId.split('@')[0]} has been removed from the group for sending links (3 warnings reached).`,
                    mentions: [senderId]
                });
            } catch (error) {
                console.error('Failed to kick user:', error);
                await sock.sendMessage(chatId, {
                    text: `⚠️ Failed to remove user. Make sure the bot is an admin.`
                });
            }
        }

    } catch (error) {
        console.error('Error in link detection:', error);
    }
}

module.exports = {
    command: 'antilink',
    aliases: ['alink', 'linkblock'],
    category: 'admin',
    description: 'Prevent users from sending links in the group (3 warnings = auto-kick)',
    usage: '.antilink <on|off|status>',
    groupOnly: true,
    adminOnly: true,
    cooldown: 2000,

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const action = args[0]?.toLowerCase();

        if (!action) {
            const config = await getAntilink(chatId, 'on');
            await sock.sendMessage(chatId, {
                text: `*🔗 ANTILINK SETUP*\n\n` +
                      `*Current Status:* ${config?.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
                      `*Commands:*\n` +
                      `• \`.antilink on\` - Enable antilink with warnings\n` +
                      `• \`.antilink off\` - Disable antilink\n` +
                      `• \`.antilink status\` - Show antilink status\n\n` +
                      `*How it works:*\n` +
                      `1️⃣ First link sent → User tagged + "links not allowed" message\n` +
                      `2️⃣ Second link → User receives 2/3 warnings\n` +
                      `3️⃣ Third link → User is automatically removed from group\n\n` +
                      `*Protected Links:*\n` +
                      `• WhatsApp Groups\n` +
                      `• WhatsApp Channels\n` +
                      `• Telegram\n` +
                      `• All other links\n\n` +
                      `*Exempt:* Admins, Owner, and Sudo users are exempt.`
            }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on':
                const existingConfig = await getAntilink(chatId, 'on');
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Antilink is already enabled*'
                    }, { quoted: message });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'warn');
                await sock.sendMessage(chatId, {
                    text: result ? `✅ *Antilink enabled successfully!*\n\n🔔 *Warning System Active:*\n• 1st link: Warning (1/3)\n• 2nd link: Warning (2/3)\n• 3rd link: User removed from group\n\n*Exempt:* Admins, Owner, Sudo users` : '❌ *Failed to enable antilink*'
                }, { quoted: message });
                break;

            case 'off':
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text: '❌ *Antilink disabled*\n\nUsers can now send links freely.'
                }, { quoted: message });
                break;

            case 'status':
            case 'get':
                const status = await getAntilink(chatId, 'on');
                let warnings = await getAntilinkWarnings();
                const chatWarnings = warnings[chatId] || {};
                const warningCount = Object.keys(chatWarnings).length;

                await sock.sendMessage(chatId, {
                    text: `*🔗 ANTILINK STATUS*\n\n` +
                          `*Status:* ${status?.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                          `*Users with Warnings:* ${warningCount}\n\n` +
                          `*How it Works:*\n` +
                          `• 1st link → User tagged + "links not allowed"\n` +
                          `• 2nd link → Warning count increases (2/3)\n` +
                          `• 3rd link → User removed from group\n\n` +
                          `*Exempt:* Admins, Owner, Sudo users\n\n` +
                          `*Storage:* ${HAS_DB ? 'Database' : 'File System (antilinkWarnings.json)'}`
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, {
                    text: '❌ *Invalid command*\n\nUse `.antilink` to see available options.'
                }, { quoted: message });
        }
    },

    handleLinkDetection,
    setAntilink,
    getAntilink,
    removeAntilink
};


