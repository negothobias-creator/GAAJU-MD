// channelInfo used by commands when replying or sending messages.  Originally
// this included a `forwardedNewsletterMessageInfo` object that caused every
// reply to carry a promotion to the bot's WhatsApp channel.  To comply with
// the request "remove channel promotion in all commands" we simply export an
// empty object.  Spreading this into message options is a no-op and
// guarantees nothing promotional is attached to outgoing messages.
const channelInfo = {};

module.exports = {
    channelInfo: channelInfo
};
