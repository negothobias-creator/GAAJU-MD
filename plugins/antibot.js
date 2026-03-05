const fs = require('fs');
const path = require('path');
const store = require('../lib/lightweight_store');
const { getSuccessWord, getEnabledWord, getDisabledWord, getActionEmoji } = require('../lib/funEmojis');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const databaseDir = path.join(process.cwd(), 'data');
const antibotPath = path.join(databaseDir, 'antibot.json');

function initializeFile() {
  if (!HAS_DB) {
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    
    if (!fs.existsSync(antibotPath)) {
      fs.writeFileSync(antibotPath, JSON.stringify({}), 'utf8');
    }
  }
}

async function getAntibotSettings() {
  if (HAS_DB) {
    const settings = await store.getSetting('global', 'antibot');
    return settings || {};
  } else {
    try {
      return JSON.parse(fs.readFileSync(antibotPath, 'utf8'));
    } catch (error) {
      return {};
    }
  }
}

async function saveAntibotSettings(settings) {
  if (HAS_DB) {
    await store.saveSetting('global', 'antibot', settings);
  } else {
    fs.writeFileSync(antibotPath, JSON.stringify(settings, null, 2));
  }
}

async function isAntibotEnabled(chatId) {
  const settings = await getAntibotSettings();
  return settings[chatId]?.enabled === true;
}

async function setAntibotStatus(chatId, enabled) {
  const settings = await getAntibotSettings();
  if (!settings[chatId]) {
    settings[chatId] = {};
  }
  settings[chatId].enabled = enabled;
  settings[chatId].updatedAt = new Date().toISOString();
  settings[chatId].kickCount = settings[chatId].kickCount || 0;
  await saveAntibotSettings(settings);
}

async function incrementBotKickCount(chatId) {
  const settings = await getAntibotSettings();
  if (!settings[chatId]) {
    settings[chatId] = { enabled: true, kickCount: 0 };
  }
  settings[chatId].kickCount = (settings[chatId].kickCount || 0) + 1;
  settings[chatId].lastBotKicked = new Date().toISOString();
  await saveAntibotSettings(settings);
}

module.exports = {
  command: 'antibot',
  aliases: ['nobot', 'botban'],
  category: 'admin',
  description: 'Auto-remove other bots from the group',
  usage: '.antibot on|off|status|scan',
  groupOnly: true,
  adminOnly: true,
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const { chatId, isBotAdmin, channelInfo } = context;

    initializeFile();

    if (!args[0]) {
      const enabled = await isAntibotEnabled(chatId);
      const settings = await getAntibotSettings();
      const groupStats = settings[chatId] || {};

      await sock.sendMessage(chatId, {
        text: `🤖 *Antibot Status*\n\nStatus: ${enabled ? getEnabledWord() : getDisabledWord()}\nBots Kicked: ${groupStats.kickCount || 0}\n\n*Commands:*\n.antibot on - Enable protection\n.antibot off - Disable protection\n.antibot status - Show status\n.antibot scan - Scan and remove existing bots`,
        ...channelInfo
      }, { quoted: message });
      return;
    }

    const action = args[0].toLowerCase();

    try {
      switch (action) {
        case 'on':
        case 'enable':
          await setAntibotStatus(chatId, true);
          await sock.sendMessage(chatId, {
            text: `${getActionEmoji('ban')} *Antibot Enabled*\n\nOther bots joining this group will be automatically removed!\n${getEnabledWord()}`,
            ...channelInfo
          }, { quoted: message });
          break;

        case 'off':
        case 'disable':
          await setAntibotStatus(chatId, false);
          await sock.sendMessage(chatId, {
            text: `${getActionEmoji('warn')} *Antibot Disabled*\n\nOther bots can now join the group.\n${getDisabledWord()}`,
            ...channelInfo
          }, { quoted: message });
          break;

        case 'status':
          const enabled = await isAntibotEnabled(chatId);
          const settings = await getAntibotSettings();
          const groupStats = settings[chatId] || {};
          await sock.sendMessage(chatId, {
            text: `ℹ️ *Antibot Status*\n\n📍 Current Status: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}\n👾 Bots Kicked: ${groupStats.kickCount || 0}\n🕐 Last Bot Kicked: ${groupStats.lastBotKicked ? new Date(groupStats.lastBotKicked).toLocaleString() : 'None'}`,
            ...channelInfo
          }, { quoted: message });
          break;

        case 'scan':
          if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
              text: '❌ The bot must be admin to scan and remove bots.',
              ...channelInfo
            }, { quoted: message });
            return;
          }

          await sock.sendMessage(chatId, {
            text: '🔍 *Scanning for bots...*',
            ...channelInfo
          }, { quoted: message });

          try {
            const metadata = await sock.groupMetadata(chatId);
            const participants = metadata.participants || [];
            const botJid = sock.user?.id || '';
            let botsRemoved = 0;
            const botsList = [];

            for (const participant of participants) {
              // Check if participant is a bot (bots typically have 'Bot' in name or are business accounts)
              if (participant.id !== botJid && (participant.name?.includes('Bot') || 
                  participant.name?.includes('bot') || 
                  participant.id.startsWith('212') || // Some bot indicators
                  participant.isAdmin === false && participant.isSuperAdmin === false && 
                  !participant.name)) {
                
                try {
                  await sock.groupParticipantsUpdate(chatId, [participant.id], "remove");
                  botsRemoved++;
                  botsList.push(participant.id);
                  await incrementBotKickCount(chatId);
                  
                  // Add delay to avoid rate limiting
                  await new Promise(resolve => setTimeout(resolve, 500));
                } catch (kickError) {
                  console.error(`Failed to kick bot ${participant.id}:`, kickError);
                }
              }
            }

            if (botsRemoved > 0) {
              await sock.sendMessage(chatId, {
                text: `${getActionEmoji('kick')} *Scan Complete*\n\n✅ Removed ${botsRemoved} bot(s) from the group!\n${getSuccessWord()}`,
                mentions: botsList,
                ...channelInfo
              });
            } else {
              await sock.sendMessage(chatId, {
                text: `✅ *Scan Complete*\n\nNo bots found in the group.\n${getSuccessWord()}`,
                ...channelInfo
              });
            }
          } catch (scanError) {
            console.error('Error scanning for bots:', scanError);
            await sock.sendMessage(chatId, {
              text: '❌ Error scanning for bots. Make sure the bot is admin.',
              ...channelInfo
            }, { quoted: message });
          }
          break;

        default:
          await sock.sendMessage(chatId, {
            text: '❌ Invalid action. Use: on, off, status, or scan',
            ...channelInfo
          }, { quoted: message });
      }
    } catch (error) {
      console.error('Error in antibot command:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Error managing antibot settings.',
        ...channelInfo
      }, { quoted: message });
    }
  }
};

module.exports.isAntibotEnabled = isAntibotEnabled;
module.exports.incrementBotKickCount = incrementBotKickCount;
