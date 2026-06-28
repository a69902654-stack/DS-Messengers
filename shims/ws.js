// Shim for 'ws' WebSocket library used by @supabase/realtime-js
// React Native has a built-in WebSocket implementation, so we export
// the global WebSocket instead of the Node.js 'ws' package.
const W = typeof WebSocket !== 'undefined' ? WebSocket : null;
module.exports = W;
module.exports.default = W;
