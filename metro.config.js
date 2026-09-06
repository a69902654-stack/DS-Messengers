// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add alias support for @/
config.resolver.alias = {
  '@': path.resolve(__dirname),
};

// Fix: @supabase/realtime-js bundles a nested 'ws' package that uses
// Node.js built-ins (stream, zlib, etc.) unavailable in React Native.
// We redirect 'ws' to a shim that uses the native WebSocket global.
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect the nested 'ws' package to our shim
  if (moduleName === 'ws') {
    return {
      filePath: require.resolve('./shims/ws.js'),
      type: 'sourceFile',
    };
  }
  // Redirect Node.js built-ins to empty shims
  if (moduleName === 'stream' || moduleName === 'zlib' || moduleName === 'fs' || moduleName === 'net' || moduleName === 'tls') {
    return {
      filePath: require.resolve('./shims/stream.js'),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
