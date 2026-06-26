const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for @supabase/realtime-js using Node.js 'ws' package
// which tries to import 'stream' - not available in React Native
config.resolver.extraNodeModules = {
  stream: require.resolve('readable-stream'),
};

module.exports = config;
