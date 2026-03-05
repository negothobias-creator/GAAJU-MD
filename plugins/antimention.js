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
const antimentionPath = path.join(databaseDir, 'antimention.json');

function initializeFile() {
  if (!HAS_DB) {
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    
    if (!fs.existsSync(antimentionPath)) {
      fs.writeFileSync(antimentionPath, JSON.stringify({}), 'utf8');
    }
  }
}

async function getAntimentionSettings() {
  if (HAS_DB) {
    const settings = await store.getSetting('global', 'antimention');
    return settings || {};
  } else {
    try {
      return JSON.parse(fs.readFileSync(antimentionPath, 'utf8'));
    } catch (error) {
      return {};
    }
  }
}

async function saveAntimentionSettings(settings) {
  if (HAS_DB) {
    await store.saveSetting('global', 'antimention', settings);
  } else {
    fs.writeFileSync(antimentionPath, JSON.stringify(settings, null, 2));
  }
}

async function isAntimentionEnabled(chatId) {
  const settings = await getAntimentionSettings();
  return settings[chatId]?.enabled === true;
}

async function setAntimentionStatus(chatId, enabled) {
  const settings = await getAntimentionSettings();
  if (!settings[chatId]) {
    settings[chatId] = {};
  }
  settings[chatId].enabled = enabled;
  settings[chatId].updatedAt = new Date().toISOString();
  await saveAntimentionSettings(settings);
}

module.exports = {
  command: 'antimention',
  aliases: ['antigroup', 'groupmention'],
  category: 'admin',
  description: 'Prevent group mentions (@group) and delete messages',
  usage: '.antimention on|off|status',
  groupOnly: true,
  adminOnly: true,
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const { chatId, channelInfo } = context;

    initializeFile();

    if (!args[0]) {
      const enabled = await isAntimentionEnabled(chatId);
      await sock.sendMessage(chatId, {
        text: `🛡️ *Antimention Status*\n\nStatus: ${enabled ? getEnabledWord() : getDisabledWord()}\n\n*Commands:*\n.antimention on - Enable protection\n.antimention off - Disable protection\n.antimention status - Show status`,
        ...channelInfo
      }, { quoted: message });
      return;
    }

    const action = args[0].toLowerCase();

    try {
      switch (action) {
        case 'on':
        case 'enable':
          await setAntimentionStatus(chatId, true);
          await sock.sendMessage(chatId, {
            text: `${getActionEmoji('warn')} *Antimention Enabled*\n\nGroup mentions (@group) will now be deleted automatically!\n${getEnabledWord()}`,
            ...channelInfo
          }, { quoted: message });
          break;

        case 'off':
        case 'disable':
          await setAntimentionStatus(chatId, false);
          await sock.sendMessage(chatId, {
            text: `${getActionEmoji('warn')} *Antimention Disabled*\n\nGroup mentions are now allowed.\n${getDisabledWord()}`,
            ...channelInfo
          }, { quoted: message });
          break;

        case 'status':
          const enabled = await isAntimentionEnabled(chatId);
          await sock.sendMessage(chatId, {
            text: `ℹ️ *Antimention Status*\n\n📍 Current Status: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n${enabled ? '🚫 Group mentions will be deleted' : '✅ Group mentions are allowed'}`,
            ...channelInfo
          }, { quoted: message });
          break;

        default:
          await sock.sendMessage(chatId, {
            text: '❌ Invalid action. Use: on, off, or status',
            ...channelInfo
          }, { quoted: message });
      }
    } catch (error) {
      console.error('Error in antimention command:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Error managing antimention settings.',
        ...channelInfo
      }, { quoted: message });
    }
  }
};

module.exports.isAntimentionEnabled = isAntimentionEnabled;
