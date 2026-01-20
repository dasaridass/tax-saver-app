const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname, {
  // [Web-only]: This enables CSS support so Tailwind/NativeWind works
  isCSSEnabled: true,
});

// This helps load assets (images/icons) correctly
config.resolver.assetExts.push('cjs');

module.exports = config;