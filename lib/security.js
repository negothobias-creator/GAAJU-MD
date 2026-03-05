const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECURITY_FILE = path.join(__dirname, '../data/security.json');

// Initialize security file
function initSecurityFile() {
  if (!fs.existsSync(SECURITY_FILE)) {
    const defaultSecurity = {
      mainOwner: null,
      authorizedUsers: [],
      restartPin: process.env.RESTART_PIN || '0000',
      securityLog: [],
      failedAttempts: {},
      lockdownMode: false,
      blacklistedUsers: []
    };
    fs.writeFileSync(SECURITY_FILE, JSON.stringify(defaultSecurity, null, 2));
    return defaultSecurity;
  }
  try {
    return JSON.parse(fs.readFileSync(SECURITY_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to read security file:', e);
    return null;
  }
}

// Read security data
function readSecurity() {
  try {
    if (!fs.existsSync(SECURITY_FILE)) {
      return initSecurityFile();
    }
    return JSON.parse(fs.readFileSync(SECURITY_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to read security file:', err);
    return initSecurityFile();
  }
}

// Write security data
function writeSecurity(data) {
  try {
    fs.writeFileSync(SECURITY_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to write security file:', err);
  }
}

// Log security events
function logSecurityEvent(event, user, action, status, details = '') {
  const data = readSecurity();
  const eventLog = {
    timestamp: new Date().toISOString(),
    event,
    user,
    action,
    status,
    details
  };
  
  data.securityLog.push(eventLog);
  // Keep only last 100 events
  if (data.securityLog.length > 100) {
    data.securityLog = data.securityLog.slice(-100);
  }
  
  writeSecurity(data);
  console.log(`[SECURITY] ${event}: ${user} - ${action} - ${status}`);
}

// Verify restart authentication
function verifyRestartAuth(userId, pin) {
  const data = readSecurity();
  const now = Date.now();
  const failedAttempts = data.failedAttempts[userId] || { count: 0, lastAttempt: 0 };
  
  // Block after 5 failed attempts for 5 minutes
  if (failedAttempts.count >= 5) {
    const timeSinceLastAttempt = now - failedAttempts.lastAttempt;
    if (timeSinceLastAttempt < 5 * 60 * 1000) {
      logSecurityEvent('RESTART_ATTEMPT', userId, `PIN verification blocked - too many attempts`, 'BLOCKED');
      return { 
        success: false, 
        reason: 'RATE_LIMITED',
        remainingTime: Math.ceil((5 * 60 * 1000 - timeSinceLastAttempt) / 1000)
      };
    } else {
      failedAttempts.count = 0;
    }
  }
  
  // Check if in lockdown mode
  if (data.lockdownMode && !data.mainOwner?.includes(userId)) {
    logSecurityEvent('RESTART_ATTEMPT', userId, 'Bot in lockdown mode', 'BLOCKED');
    return { 
      success: false, 
      reason: 'LOCKDOWN_MODE'
    };
  }
  
  // Check blacklist
  if (data.blacklistedUsers.includes(userId)) {
    logSecurityEvent('RESTART_ATTEMPT', userId, 'User is blacklisted', 'BLOCKED');
    return { 
      success: false, 
      reason: 'BLACKLISTED'
    };
  }
  
  // Verify PIN
  if (String(pin) !== String(data.restartPin)) {
    failedAttempts.count++;
    failedAttempts.lastAttempt = now;
    data.failedAttempts[userId] = failedAttempts;
    writeSecurity(data);
    
    logSecurityEvent('RESTART_ATTEMPT', userId, 'Invalid PIN', 'DENIED');
    return { 
      success: false, 
      reason: 'INVALID_PIN',
      attemptsLeft: Math.max(0, 5 - failedAttempts.count)
    };
  }
  
  // Reset failed attempts on success
  data.failedAttempts[userId] = { count: 0, lastAttempt: 0 };
  writeSecurity(data);
  
  logSecurityEvent('RESTART_ATTEMPT', userId, 'Valid PIN', 'AUTHORIZED');
  return { success: true };
}

// Add user to authorized list
function authorizeUser(userId) {
  const data = readSecurity();
  if (!data.authorizedUsers.includes(userId)) {
    data.authorizedUsers.push(userId);
    writeSecurity(data);
    logSecurityEvent('USER_AUTHORIZATION', userId, 'Added to authorized list', 'SUCCESS');
  }
}

// Check if user is authorized
function isAuthorized(userId) {
  const data = readSecurity();
  return data.authorizedUsers.includes(userId) || data.mainOwner?.includes(userId);
}

// Set main owner
function setMainOwner(userId) {
  const data = readSecurity();
  if (!data.mainOwner) {
    data.mainOwner = [];
  }
  if (!data.mainOwner.includes(userId)) {
    data.mainOwner.push(userId);
    writeSecurity(data);
    logSecurityEvent('MAIN_OWNER_SET', userId, 'Set as main owner', 'SUCCESS');
  }
}

// Enable lockdown mode
function enableLockdown() {
  const data = readSecurity();
  data.lockdownMode = true;
  writeSecurity(data);
  logSecurityEvent('LOCKDOWN', 'SYSTEM', 'Lockdown mode enabled', 'SUCCESS');
}

// Disable lockdown mode
function disableLockdown() {
  const data = readSecurity();
  data.lockdownMode = false;
  writeSecurity(data);
  logSecurityEvent('LOCKDOWN', 'SYSTEM', 'Lockdown mode disabled', 'SUCCESS');
}

// Blacklist user
function blacklistUser(userId) {
  const data = readSecurity();
  if (!data.blacklistedUsers.includes(userId)) {
    data.blacklistedUsers.push(userId);
    writeSecurity(data);
    logSecurityEvent('BLACKLIST', userId, 'User blacklisted', 'SUCCESS');
  }
}

// Get security status
function getSecurityStatus() {
  const data = readSecurity();
  return {
    mainOwner: data.mainOwner || [],
    authorizedUsers: data.authorizedUsers,
    lockdownMode: data.lockdownMode,
    blacklistedUsers: data.blacklistedUsers,
    recentEvents: data.securityLog.slice(-10),
    failedAttempts: Object.keys(data.failedAttempts).length
  };
}

// Initialize on load
initSecurityFile();

module.exports = {
  verifyRestartAuth,
  authorizeUser,
  isAuthorized,
  setMainOwner,
  enableLockdown,
  disableLockdown,
  blacklistUser,
  getSecurityStatus,
  logSecurityEvent,
  readSecurity,
  writeSecurity
};
