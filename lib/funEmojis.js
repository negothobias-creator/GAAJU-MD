// Fun words, emojis, and responses for bot commands

const funWords = {
  success: [
    '✅ Done!',
    '🎉 Perfect!',
    '⚡ Boom!',
    '🔥 Awesome!',
    '💯 Flawless!',
    '🚀 Launched!',
    '✨ Magic!',
    '🎯 Nailed it!',
    '😎 Cool!',
    '👊 Complete!',
  ],
  enabled: [
    '✨ Activated!',
    '🔥 Powered Up!',
    '⚡ Live Now!',
    '🎯 Enabled!',
    '🚀 Let\'s Go!',
    '💪 Ready!',
    '🎊 On!',
    '⚙️ Engaged!',
    '💥 Turbo!',
    '🌟 Bright!'
  ],
  disabled: [
    '💤 Disabled',
    '⏸️ Paused',
    '🔌 Off',
    '❌ Deactivated',
    '🌙 Sleeping',
    '🛑 Stopped',
    '⚠️ Offline',
    '🔕 Silenced',
    '😴 Dormant',
    '❄️ Frozen'
  ],
  error: [
    '❌ Oops!',
    '😅 Whoops!',
    '⚠️ Error!',
    '💔 Failed!',
    '🤔 Hmm...',
    '😣 Problem!',
    '🚫 Blocked!',
    '💥 Crash!',
    '🆘 Help!',
    '😩 Trouble!'
  ],
  waiting: [
    '⏳ Processing...',
    '🔄 Loading...',
    '⌛ Thinking...',
    '🤖 Computing...',
    '📡 Syncing...',
    '⚙️ Working...',
    '🔍 Searching...',
    '📥 Fetching...',
    '💫 Buffering...',
    '🎬 Running...'
  ],
  info: [
    '📢 Info:',
    'ℹ️ Notice:',
    '📌 Heads up:',
    '💡 Tip:',
    '🔔 Alert:',
    '📣 Announcement:',
    '📰 Update:',
    '📝 Note:',
    '🎙️ Broadcast:',
    '📖 Details:'
  ]
};

const actionEmojis = {
  ban: '🚫',
  kick: '💥',
  warn: '⚠️',
  approve: '✅',
  reject: '❌',
  mute: '🔇',
  unmute: '🔊',
  promote: '📈',
  demote: '📉',
  remove: '🗑️',
  add: '➕',
  delete: '🗑️',
  update: '🔄',
  reset: '🔁',
  lock: '🔒',
  unlock: '🔓',
  enable: '🟢',
  disable: '🔴'
};

const greetings = [
  '👋 Hey there!',
  '🙋 Hello!',
  '😊 Hi!',
  '👋 Yo!',
  '🤖 Beep boop!',
  '💬 What\'s up!',
  '😄 Howdy!',
  '🌟 Sup!',
  '👀 Noticed you!',
  '💫 Peeking at you!'
];

// Get random item from array
function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Get random success message
function getSuccessWord() {
  return getRandomItem(funWords.success);
}

// Get random enabled message
function getEnabledWord() {
  return getRandomItem(funWords.enabled);
}

// Get random disabled message
function getDisabledWord() {
  return getRandomItem(funWords.disabled);
}

// Get random error message
function getErrorWord() {
  return getRandomItem(funWords.error);
}

// Get random waiting message
function getWaitingWord() {
  return getRandomItem(funWords.waiting);
}

// Get random info message
function getInfoWord() {
  return getRandomItem(funWords.info);
}

// Get random greeting
function getGreeting() {
  return getRandomItem(greetings);
}

// Get action emoji
function getActionEmoji(action) {
  return actionEmojis[action] || '⚡';
}

module.exports = {
  funWords,
  actionEmojis,
  greetings,
  getRandomItem,
  getSuccessWord,
  getEnabledWord,
  getDisabledWord,
  getErrorWord,
  getWaitingWord,
  getInfoWord,
  getGreeting,
  getActionEmoji
};
