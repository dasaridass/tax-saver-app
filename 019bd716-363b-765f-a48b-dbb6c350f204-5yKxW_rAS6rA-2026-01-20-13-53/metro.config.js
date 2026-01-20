const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname, {
  // [Web-only]: This enables CSS support so Tailwind/NativeWind works
  isCSSEnabled: true,
});

module.exports = config;