const fs = require('fs');
const path = require('path');
const store = require('../lib/lightweight_store');
const { printLog } = require('../lib/print');

const ACTIVITY_FILE = path.join(__dirname, '../data/userActivity.json');

// Initialize activity tracking
function initActivityFile() {
  if (!fs.existsSync(ACTIVITY_FILE)) {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify({}, null, 2));
  }
}

// Read activity data
function readActivity() {
  try {
    if (!fs.existsSync(ACTIVITY_FILE)) return {};
    return JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
  } catch (err) {
    printLog('error', `Failed to read activity file: ${err.message}`);
    return {};
  }
}

// Write activity data
function writeActivity(data) {
  try {
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    printLog('error', `Failed to write activity file: ${err.message}`);
  }
}

// Update user activity timestamp
function recordActivity(chatId, userId) {
  const data = readActivity();
  if (!data[chatId]) {
    data[chatId] = {};
  }
  data[chatId][userId] = Date.now();
  writeActivity(data);
}

// Get last activity time for a user
function getLastActivity(chatId, userId) {
  const data = readActivity();
  return data[chatId]?.[userId] || 0;
}

// Get inactive users in a group
function getInactiveUsers(chatId, inactiveDays) {
  const data = readActivity();
  const thirtyDaysAgo = Date.now() - (inactiveDays * 24 * 60 * 60 * 1000);
  
  if (!data[chatId]) {
    return [];
  }

  return Object.entries(data[chatId])
    .filter(([userId, timestamp]) => timestamp < thirtyDaysAgo && !userId.endsWith('@g.us'))
    .map(([userId]) => userId);
}

// Expose functions globally for messageHandler to use
global.recordUserActivity = recordActivity;

// Hook into messageHandler to record activity
setTimeout(() => {
  try {
    initActivityFile();
    printLog('success', '✅ User activity tracking initialized');
  } catch (err) {
    printLog('error', `Failed to initialize activity tracking: ${err.message}`);
  }
}, 1000);

module.exports = {
  command: 'kickinactive',
  aliases: ['kickidle', 'kickinactiveusers'],
  category: 'admin',
  description: 'Kick users inactive for given days',
  usage: '.kickinactive <days>',
  groupOnly: true,
  adminOnly: true,
  cooldown: 3000,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const channelInfo = context.channelInfo || {};
    const inactiveDays = parseInt(args[0], 10) || 0;

    if (!inactiveDays || inactiveDays <= 0) {
      await sock.sendMessage(chatId, {
        text: '❌ Usage: `.kickinactive <days>`\n\nExample: `.kickinactive 7` will kick users inactive for 7+ days.'
      }, { quoted: message });
      return;
    }

    try {
      // Check if bot is admin
      const metadata = await sock.groupMetadata(chatId);
      const botJid = sock.user?.id || '';
      const isBotAdmin = metadata.participants.some(p => 
        p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
      );

      if (!isBotAdmin) {
        await sock.sendMessage(chatId, {
          text: '❌ *Please make the bot an admin first*',
          ...channelInfo
        }, { quoted: message });
        return;
      }

      // Get list of inactive users
      const inactiveUsers = getInactiveUsers(chatId, inactiveDays);

      if (inactiveUsers.length === 0) {
        await sock.sendMessage(chatId, {
          text: `✅ Great! No users have been inactive for ${inactiveDays}+ days.`,
          ...channelInfo
        }, { quoted: message });
        return;
      }

      // Send warning message
      const warningMessage = `⚠️ *Inactive User Removal*\n\nAbout to kick ${inactiveUsers.length} user(s) inactive for ${inactiveDays}+ days...\n\n⏳ Processing...`;
      
      const warningMsg = await sock.sendMessage(chatId, {
        text: warningMessage,
        ...channelInfo
      });

      // Kick the inactive users
      let successCount = 0;
      let failureCount = 0;

      for (const userId of inactiveUsers) {
        try {
          await sock.groupParticipantsUpdate(chatId, [userId], 'remove');
          successCount++;
          
          // Small delay between kicks to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to kick ${userId}:`, error.message);
          failureCount++;
        }
      }

      // Send result message
      const resultMessage = `✅ *Inactive User Removal Complete*\n\n📊 Results:\n• Kicked: ${successCount}\n• Failed: ${failureCount}\n• Total Inactive: ${inactiveUsers.length}\n\n⏱️ Days inactive: ${inactiveDays}+`;

      await sock.sendMessage(chatId, {
        text: resultMessage,
        ...channelInfo
      });

      printLog('success', `Kicked ${successCount} inactive users from ${chatId}`);

    } catch (error) {
      console.error('Error in kickinactive command:', error);
      await sock.sendMessage(chatId, {
        text: `❌ Error: ${error.message}`,
        ...channelInfo
      }, { quoted: message });
    }
  }
};
