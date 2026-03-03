require('dotenv').config();

const settings = {
  // Array fallback: splits string by comma, or uses default array
  prefixes: process.env.PREFIXES ? process.env.PREFIXES.split(',') : ['.', '!', '/', '#'],
  
  packname: process.env.PACKNAME || 'NEGO-TECH',
  author: process.env.AUTHOR || 'Xnegotech1',
  timeZone: process.env.TIMEZONE || 'Africa/Lagos',
  botName: process.env.BOT_NAME || "NEGO-TECH",
  botOwner: process.env.BOT_OWNER || 'Nego',
  ownerNumber: process.env.OWNER_NUMBER || '255785671823',
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: process.env.COMMAND_MODE || "public",
  
  maxStoreMessages: Number(process.env.MAX_STORE_MESSAGES) || 20,
  tempCleanupInterval: Number(process.env.CLEANUP_INTERVAL) || 1 * 60 * 60 * 1000,
  storeWriteInterval: Number(process.env.STORE_WRITE_INTERVAL) || 10000,
  
  description: process.env.DESCRIPTION || "This is a bot for managing group commands and automating tasks.",
  version: "5.2.0",
  updateZipUrl: process.env.UPDATE_URL || "https://github.com/Xnegotech1/NEGO-TECH/archive/refs/heads/main.zip",
  channelLink: process.env.CHANNEL_LINK || "https://whatsapp.com/channel/0029VbBvGgyFsn0alyIDjw0z",
  ytch: process.env.YT_CHANNEL || "Xchristech"
};

module.exports = settings;
