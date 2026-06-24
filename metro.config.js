const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for @supabase/realtime-js using Node.js 'ws' package
// which tries to import 'stream' - not available in React Native
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect 'stream' to a React Native compatible polyfill
  if (moduleName === 'stream') {
    return context.resolveRequest(context, 'readable-stream', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Force ws to use browser version (not Node.js version)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve('readable-stream'),
};

module.exports = config;
