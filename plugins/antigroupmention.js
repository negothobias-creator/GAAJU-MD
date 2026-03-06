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
const antigroupmentionPath = path.join(databaseDir, 'antigroupmention.json');

function initializeFile() {
  if (!HAS_DB) {
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }
    
    if (!fs.existsSync(antigroupmentionPath)) {
      fs.writeFileSync(antigroupmentionPath, JSON.stringify({}), 'utf8');
    }
  }
}

async function getAntiGroupMentionSettings() {
  if (HAS_DB) {
    const settings = await store.getSetting('global', 'antigroupmention');
    return settings || {};
  } else {
    try {
      if (fs.existsSync(antigroupmentionPath)) {
        return JSON.parse(fs.readFileSync(antigroupmentionPath, 'utf8'));
      }
      // migrate old antimention file if present
      const oldPath = path.join(databaseDir, 'antimention.json');
      if (fs.existsSync(oldPath)) {
        const data = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
        fs.writeFileSync(antigroupmentionPath, JSON.stringify(data, null, 2));
        try { fs.unlinkSync(oldPath); } catch {};
        return data;
      }
      return {};
    } catch (error) {
      return {};
    }
  }
}

async function saveAntiGroupMentionSettings(settings) {
  if (HAS_DB) {
    await store.saveSetting('global', 'antigroupmention', settings);
  } else {
    fs.writeFileSync(antigroupmentionPath, JSON.stringify(settings, null, 2));
  }
}

async function isAntiGroupMentionEnabled(chatId) {
  const settings = await getAntiGroupMentionSettings();
  return settings[chatId]?.enabled === true;
}

async function setAntiGroupMentionStatus(chatId, enabled) {
  const settings = await getAntiGroupMentionSettings();
  if (!settings[chatId]) {
    settings[chatId] = {};
  }
  settings[chatId].enabled = enabled;
  settings[chatId].updatedAt = new Date().toISOString();
  await saveAntiGroupMentionSettings(settings);
}

module.exports = {
  command: 'antigroupmention',
  aliases: ['antimention', 'antigroup', 'groupmention'],
  category: 'admin',
  description: 'Prevent group mentions (@group) and delete messages',
  usage: '.antigroupmention on|off|status|reset',
  groupOnly: true,
  adminOnly: true,
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const { chatId, channelInfo } = context;

    initializeFile();

    if (!args[0]) {
      const enabled = await isAntiGroupMentionEnabled(chatId);
      await sock.sendMessage(chatId, {
        text: `🛡️ *Anti‑Group‑Mention Status*\n\nStatus: ${enabled ? getEnabledWord() : getDisabledWord()}\n\n*Commands:*\n.antigroupmention on - Enable protection\n.antigroupmention off - Disable protection\n.antigroupmention status - Show status`,
        ...channelInfo
      }, { quoted: message });
      return;
    }

    const action = args[0].toLowerCase();

    try {
      switch (action) {
        case 'on':
        case 'enable':
          await setAntiGroupMentionStatus(chatId, true);
          await sock.sendMessage(chatId, {
            text: `${getActionEmoji('warn')} *Anti‑Group‑Mention Enabled*\n\nGroup mentions (@group) will now be deleted automatically!\n${getEnabledWord()}`,
            ...channelInfo
          }, { quoted: message });
          break;

        case 'off':
        case 'disable':
          await setAntiGroupMentionStatus(chatId, false);
          await sock.sendMessage(chatId, {
            text: `${getActionEmoji('warn')} *Anti‑Group‑Mention Disabled*\n\nGroup mentions are now allowed.\n${getDisabledWord()}`,
            ...channelInfo
          }, { quoted: message });
          break;

        case 'status':
          const enabled = await isAntiGroupMentionEnabled(chatId);
          await sock.sendMessage(chatId, {
            text: `ℹ️ *Anti‑Group‑Mention Status*\n\n📍 Current Status: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n${enabled ? '🚫 Group mentions will be deleted' : '✅ Group mentions are allowed'}`,
            ...channelInfo
          }, { quoted: message });
          break;

        case 'reset':
          // simply disable the feature
          await setAntiGroupMentionStatus(chatId, false);
          await sock.sendMessage(chatId, {
            text: `${getActionEmoji('warn')} *Anti‑Group‑Mention Reset*

Feature disabled and settings cleared.`,
            ...channelInfo
          }, { quoted: message });
          break;
        default:
          await sock.sendMessage(chatId, {
            text: '❌ Invalid action. Use: on, off, status, or reset',
            ...channelInfo
          }, { quoted: message });
      }
    } catch (error) {
      console.error('Error in anti-group-mention command:', error);
      await sock.sendMessage(chatId, {
        text: '❌ Error managing anti-group-mention settings.',
        ...channelInfo
      }, { quoted: message });
    }
  }
};

module.exports.isAntiGroupMentionEnabled = isAntiGroupMentionEnabled;
