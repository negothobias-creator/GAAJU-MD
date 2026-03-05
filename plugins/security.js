const fs = require('fs');
const path = require('path');
const security = require('../lib/security');
const { getSuccessWord, getActionEmoji } = require('../lib/funEmojis');

module.exports = {
  command: 'security',
  aliases: ['sec', 'protect'],
  category: 'owner',
  description: 'Manage bot security settings',
  usage: '.security <action> [parameters]',
  ownerOnly: true,
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const { chatId, channelInfo, senderId } = context;

    if (!args[0]) {
      const status = security.getSecurityStatus();
      const statusText = `🔒 *Bot Security Status*\n\n` +
        `✅ Main Owner(s): ${status.mainOwner.length > 0 ? status.mainOwner.map(u => u.split('@')[0]).join(', ') : 'Not set'}\n` +
        `👥 Authorized Users: ${status.authorizedUsers.length}\n` +
        `🚨 Lockdown Mode: ${status.lockdownMode ? 'ON 🔴' : 'OFF 🟢'}\n` +
        `⛔ Blacklisted Users: ${status.blacklistedUsers.length}\n` +
        `❌ Failed Attempts (Last Hour): ${status.failedAttempts}\n\n` +
        `*Commands:*\n` +
        `.security status - Show full status\n` +
        `.security setpin <new_pin> - Set restart PIN\n` +
        `.security lockdown - Enable lockdown mode\n` +
        `.security unlock - Disable lockdown mode\n` +
        `.security blacklist @user - Blacklist a user\n` +
        `.security authorize @user - Add authorized user\n` +
        `.security logs - Show recent security logs`;

      await sock.sendMessage(chatId, { 
        text: statusText,
        ...channelInfo
      }, { quoted: message });
      return;
    }

    const action = args[0].toLowerCase();

    try {
      switch (action) {
        case 'status': {
          const status = security.getSecurityStatus();
          let statusText = `🔒 *Complete Security Status*\n\n`;
          
          statusText += `📍 Main Owner:\n`;
          if (status.mainOwner.length > 0) {
            status.mainOwner.forEach(owner => {
              statusText += `  • ${owner.split('@')[0]}\n`;
            });
          } else {
            statusText += `  • Not configured\n`;
          }
          
          statusText += `\n👥 Authorized Users (${status.authorizedUsers.length}):\n`;
          if (status.authorizedUsers.length > 0) {
            status.authorizedUsers.slice(0, 5).forEach(user => {
              statusText += `  • ${user.split('@')[0]}\n`;
            });
            if (status.authorizedUsers.length > 5) {
              statusText += `  ... and ${status.authorizedUsers.length - 5} more\n`;
            }
          } else {
            statusText += `  • None\n`;
          }
          
          statusText += `\n🚨 Lockdown: ${status.lockdownMode ? 'ENABLED 🔴' : 'DISABLED 🟢'}\n`;
          statusText += `⛔ Blacklist: ${status.blacklistedUsers.length} user(s)\n`;
          statusText += `⚠️ Failed Attempts: ${status.failedAttempts} user(s)\n\n`;
          
          statusText += `📜 Recent Events:\n`;
          if (status.recentEvents.length > 0) {
            status.recentEvents.slice(-5).forEach(event => {
              const time = new Date(event.timestamp).toLocaleTimeString();
              statusText += `  [${time}] ${event.event} - ${event.status}\n`;
            });
          } else {
            statusText += `  • No recent events\n`;
          }

          await sock.sendMessage(chatId, { 
            text: statusText,
            ...channelInfo
          }, { quoted: message });
          break;
        }

        case 'setpin': {
          if (!args[1]) {
            await sock.sendMessage(chatId, { 
              text: '❌ Please provide a new PIN.\n\nUsage: `.security setpin <4-digit-pin>`',
              ...channelInfo
            }, { quoted: message });
            return;
          }

          const newPin = args[1];
          if (!/^\d{4,6}$/.test(newPin)) {
            await sock.sendMessage(chatId, { 
              text: '❌ PIN must be 4-6 digits.',
              ...channelInfo
            }, { quoted: message });
            return;
          }

          const data = security.readSecurity();
          data.restartPin = newPin;
          security.writeSecurity(data);
          security.logSecurityEvent('PIN_CHANGE', senderId, 'Restart PIN changed', 'SUCCESS');

          await sock.sendMessage(chatId, { 
            text: `✅ *Restart PIN Changed*\n\n🔐 New PIN is active immediately.\n${getSuccessWord()}`,
            ...channelInfo
          }, { quoted: message });
          break;
        }

        case 'lockdown': {
          security.enableLockdown();
          await sock.sendMessage(chatId, { 
            text: '🔴 *Lockdown Mode Enabled*\n\nOnly main owner can restart the bot now.',
            ...channelInfo
          }, { quoted: message });
          break;
        }

        case 'unlock': {
          security.disableLockdown();
          await sock.sendMessage(chatId, { 
            text: '🟢 *Lockdown Mode Disabled*\n\nAuthorized users can restart the bot again.',
            ...channelInfo
          }, { quoted: message });
          break;
        }

        case 'blacklist': {
          const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
          if (!mentioned || !mentioned[0]) {
            await sock.sendMessage(chatId, { 
              text: '❌ Please mention a user to blacklist.',
              ...channelInfo
            }, { quoted: message });
            return;
          }

          const targetUser = mentioned[0];
          security.blacklistUser(targetUser);

          await sock.sendMessage(chatId, { 
            text: `⛔ @${targetUser.split('@')[0]} has been blacklisted.\n\nThey can no longer use bot commands.`,
            mentions: [targetUser],
            ...channelInfo
          }, { quoted: message });
          break;
        }

        case 'authorize': {
          const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid;
          if (!mentioned || !mentioned[0]) {
            await sock.sendMessage(chatId, { 
              text: '❌ Please mention a user to authorize.',
              ...channelInfo
            }, { quoted: message });
            return;
          }

          const targetUser = mentioned[0];
          security.authorizeUser(targetUser);

          await sock.sendMessage(chatId, { 
            text: `✅ *User Authorized*\n\n@${targetUser.split('@')[0]} is now authorized.\n\nThey can restart the bot with the correct PIN.\n${getSuccessWord()}`,
            mentions: [targetUser],
            ...channelInfo
          }, { quoted: message });
          break;
        }

        case 'logs': {
          const status = security.getSecurityStatus();
          let logsText = `📜 *Recent Security Events*\n\n`;

          if (status.recentEvents.length === 0) {
            logsText += 'No events recorded.';
          } else {
            status.recentEvents.forEach(event => {
              const time = new Date(event.timestamp).toLocaleTimeString();
              const user = event.user.split('@')[0];
              logsText += `[${time}] ${event.event}\n`;
              logsText += `  User: ${user}\n`;
              logsText += `  Action: ${event.action}\n`;
              logsText += `  Status: ${event.status}\n\n`;
            });
          }

          await sock.sendMessage(chatId, { 
            text: logsText,
            ...channelInfo
          }, { quoted: message });
          break;
        }

        default:
          await sock.sendMessage(chatId, { 
            text: '❌ Unknown security action.\n\nValid actions: status, setpin, lockdown, unlock, blacklist, authorize, logs',
            ...channelInfo
          }, { quoted: message });
      }
    } catch (error) {
      console.error('Error in security command:', error);
      await sock.sendMessage(chatId, { 
        text: `❌ Error: ${error.message}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
