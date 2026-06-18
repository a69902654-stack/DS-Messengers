const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for @supabase/supabase-js with Metro bundler
// config.resolver.unstable_enablePackageExports = false; // removed: causes issues in newer versions

module.exports = config;
