// Shim for Node.js 'stream' module used by @supabase/realtime-js/ws
// React Native doesn't have this built-in, so we provide a minimal shim
module.exports = require('readable-stream');
