const fs = require('fs');
const path = require('path');
const store = require('../lib/lightweight_store');
const { getGreeting, getSuccessWord, getEnabledWord, getDisabledWord } = require('../lib/funEmojis');

const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

const repliesPath = path.join(__dirname, '..', 'data', 'autoreplyMessages.json');

// Initialize replies file
function initializeRepliesFile() {
  if (!HAS_DB) {
    const dataDir = path.dirname(repliesPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(repliesPath)) {
      fs.writeFileSync(repliesPath, JSON.stringify({}), 'utf8');
    }
  }
}

// Get autoreply messages for a chat
async function getAutoReplyMessages(chatId) {
  if (HAS_DB) {
    const replies = await store.getSetting(chatId, 'autoreplyMessages');
    return replies || {};
  } else {
    try {
      initializeRepliesFile();
      const data = JSON.parse(fs.readFileSync(repliesPath, 'utf8'));
      return data[chatId] || {};
    } catch (error) {
      return {};
    }
  }
}

// Save autoreply messages
async function saveAutoReplyMessages(chatId, replies) {
  if (HAS_DB) {
    await store.saveSetting(chatId, 'autoreplyMessages', replies);
  } else {
    initializeRepliesFile();
    const data = JSON.parse(fs.readFileSync(repliesPath, 'utf8'));
    data[chatId] = replies;
    fs.writeFileSync(repliesPath, JSON.stringify(data, null, 2));
  }
}

// Get autoreply status
async function getAutoReplyStatus(chatId) {
  if (HAS_DB) {
    const config = await store.getSetting(chatId, 'autoreplyStatus');
    return config?.enabled || false;
  } else {
    const data = JSON.parse(fs.readFileSync(repliesPath, 'utf8'));
    return data[chatId]?.enabled || false;
  }
}

// Set autoreply status
async function setAutoReplyStatus(chatId, enabled) {
  if (HAS_DB) {
    await store.saveSetting(chatId, 'autoreplyStatus', { enabled });
  } else {
    initializeRepliesFile();
    const data = JSON.parse(fs.readFileSync(repliesPath, 'utf8'));
    if (!data[chatId]) data[chatId] = {};
    data[chatId].enabled = enabled;
    fs.writeFileSync(repliesPath, JSON.stringify(data, null, 2));
  }
}

// Check if bot is mentioned/tagged
function isBotTagged(message, botNumber) {
  if (!message.message) return false;
  
  const messageTypes = [
    'extendedTextMessage', 'imageMessage', 'videoMessage', 'stickerMessage',
    'documentMessage', 'audioMessage', 'contactMessage'
  ];
  
  for (const type of messageTypes) {
    if (message.message[type]?.contextInfo?.mentionedJid) {
      const mentionedJid = message.message[type].contextInfo.mentionedJid;
      if (mentionedJid.some(jid => jid === botNumber)) {
        return true;
      }
    }
  }
  
  const textContent = 
    message.message.conversation || 
    message.message.extendedTextMessage?.text ||
    message.message.imageMessage?.caption ||
    message.message.videoMessage?.caption || '';
  
  if (textContent) {
    const botUsername = botNumber.split('@')[0];
    if (textContent.includes(`@${botUsername}`)) {
      return true;
    }
  }
  
  return false;
}

// Handle autoreply on tag
async function handleAutoReplyOnTag(sock, message, botNumber) {
  try {
    const chatId = message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid;
    
    // Don't reply to own messages
    if (message.key.fromMe) return;
    
    // Check if autoreply is enabled
    const enabled = await getAutoReplyStatus(chatId);
    if (!enabled) return;
    
    // Check if bot is mentioned
    if (!isBotTagged(message, botNumber)) return;
    
    // Get autoreply messages
    const replies = await getAutoReplyMessages(chatId);
    if (!replies.messages || replies.messages.length === 0) return;
    
    // Get random reply
    const randomReply = replies.messages[Math.floor(Math.random() * replies.messages.length)];
    
    // Send reply
    await sock.sendMessage(chatId, {
      text: randomReply
    }, { quoted: message });
    
  } catch (error) {
    console.error('Error in handleAutoReplyOnTag:', error);
  }
}

module.exports = {
  command: 'autoreply',
  aliases: ['areply', 'autoreact'],
  category: 'general',
  description: 'Auto-reply when tagged by members',
  usage: '.autoreply <on|off|add|remove|list|status>',
  groupOnly: true,
  cooldown: 2000,

  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const action = (args[0] || '').toLowerCase();

    try {
      switch (action) {
        case 'on': {
          await setAutoReplyStatus(chatId, true);
          await sock.sendMessage(chatId, {
            text: `${getEnabledWord()} *Autoreply activated!*\n\n` +
                  `🎤 When members tag/mention me, I'll auto-reply with saved messages.\n\n` +
                  `💾 Add replies with: \`.autoreply add <message>\`\n` +
                  `📋 View all replies: \`.autoreply list\``
          }, { quoted: message });
          break;
        }

        case 'off': {
          await setAutoReplyStatus(chatId, false);
          await sock.sendMessage(chatId, {
            text: `${getDisabledWord()} *Autoreply deactivated!*\n\n` +
                  `🔇 I won't reply when tagged anymore.`
          }, { quoted: message });
          break;
        }

        case 'add': {
          if (args.length < 2) {
            await sock.sendMessage(chatId, {
              text: `❌ *Please provide a message to add*\n\n` +
                    `Usage: \`.autoreply add Hello there!\``
            }, { quoted: message });
            return;
          }

          const newReply = args.slice(1).join(' ');
          const replies = await getAutoReplyMessages(chatId);
          if (!replies.messages) replies.messages = [];
          
          if (replies.messages.includes(newReply)) {
            await sock.sendMessage(chatId, {
              text: `⚠️ *This message already exists!*\n\n` +
                    `Use \`.autoreply list\` to see all messages.`
            }, { quoted: message });
            return;
          }

          replies.messages.push(newReply);
          await saveAutoReplyMessages(chatId, replies);

          await sock.sendMessage(chatId, {
            text: `${getSuccessWord()} *Reply added!*\n\n` +
                  `💬 "${newReply}"\n\n` +
                  `Total replies: ${replies.messages.length}`
          }, { quoted: message });
          break;
        }

        case 'remove': {
          if (args.length < 2) {
            await sock.sendMessage(chatId, {
              text: `❌ *Please provide a message number to remove*\n\n` +
                    `Usage: \`.autoreply remove 1\`\n\n` +
                    `Use \`.autoreply list\` to see message numbers.`
            }, { quoted: message });
            return;
          }

          const index = parseInt(args[1]) - 1;
          const replies = await getAutoReplyMessages(chatId);
          
          if (!replies.messages || index < 0 || index >= replies.messages.length) {
            await sock.sendMessage(chatId, {
              text: `❌ *Invalid message number!*\n\n` +
                    `Use \`.autoreply list\` to see available messages.`
            }, { quoted: message });
            return;
          }

          const removed = replies.messages.splice(index, 1)[0];
          await saveAutoReplyMessages(chatId, replies);

          await sock.sendMessage(chatId, {
            text: `${getSuccessWord()} *Reply removed!*\n\n` +
                  `❌ "${removed}"\n\n` +
                  `Remaining replies: ${replies.messages.length}`
          }, { quoted: message });
          break;
        }

        case 'list': {
          const replies = await getAutoReplyMessages(chatId);
          
          if (!replies.messages || replies.messages.length === 0) {
            await sock.sendMessage(chatId, {
              text: `📭 *No replies configured yet*\n\n` +
                    `Add one with: \`.autoreply add <message>\``
            }, { quoted: message });
            return;
          }

          let listText = `📋 *Autoreply Messages (${replies.messages.length})*\n\n`;
          replies.messages.forEach((reply, index) => {
            listText += `${index + 1}. "${reply}"\n`;
          });
          listText += `\n❌ Remove: \`.autoreply remove <number>\``;

          await sock.sendMessage(chatId, { text: listText }, { quoted: message });
          break;
        }

        case 'status': {
          const enabled = await getAutoReplyStatus(chatId);
          const replies = await getAutoReplyMessages(chatId);
          const count = replies.messages?.length || 0;

          await sock.sendMessage(chatId, {
            text: `📊 *Autoreply Status*\n\n` +
                  `🔹 Status: ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `🔹 Replies: ${count}\n\n` +
                  `📌 *Features:*\n` +
                  `• Auto-reply when tagged/mentioned\n` +
                  `• Random reply from saved messages\n` +
                  `• Works in groups only\n\n` +
                  `${enabled ? '🟢 Active' : '🔴 Inactive'}`
          }, { quoted: message });
          break;
        }

        default:
          await sock.sendMessage(chatId, {
            text: `*🤖 Autoreply Help*\n\n` +
                  `\`.autoreply on\` - Enable autoreply\n` +
                  `\`.autoreply off\` - Disable autoreply\n` +
                  `\`.autoreply add <msg>\` - Add reply message\n` +
                  `\`.autoreply remove <#>\` - Delete reply\n` +
                  `\`.autoreply list\` - Show all replies\n` +
                  `\`.autoreply status\` - Check status\n\n` +
                  `💡 When enabled, I reply when you tag me!`
          }, { quoted: message });
      }
    } catch (error) {
      console.error('Error in autoreply command:', error);
      await sock.sendMessage(chatId, {
        text: `❌ *Error!*\n\nFailed to process autoreply command.`
      }, { quoted: message });
    }
  },

  handleAutoReplyOnTag
};
