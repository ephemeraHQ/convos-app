const { mergeConfig } = require("@react-native/metro-config")
const { getSentryExpoConfig } = require("@sentry/react-native/metro")

const defaultConfig = getSentryExpoConfig(__dirname)

const metroConfig = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    sourceExts: [
      ...defaultConfig.resolver.sourceExts,
      // Support .mjs files (required for Expo 49 compatibility)
      "mjs",
    ],
    // Needed for thirdweb
    unstable_enablePackageExports: true,
    // Needed for thirdweb
    unstable_conditionNames: ["react-native", "browser", "require"],
  },
}

module.exports = metroConfig
