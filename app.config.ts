import { ExpoConfig } from "expo/config"
import { version } from "./package.json"

type Environment = "development" | "preview" | "production"

type EnvironmentConfig = {
  appName: string
  scheme: string
  webDomain: string
  icon: string
  ios: {
    bundleIdentifier: string
    associatedDomains: string[]
    googleServicesFile: string
    icon?: {
      dark: string
      light: string
      tinted: string
    }
  }
  android: {
    package: string
    googleServicesFile: string
    adaptiveIcon: {
      foregroundImage: string
      backgroundColor: string
    }
  }
}

export type IExpoAppConfigExtra = {
  webDomain: string
  expoEnv: Environment
  eas: {
    projectId: string
  }
}

type ICustomExpoConfig = ExpoConfig & {
  extra: IExpoAppConfigExtra
}

const settings: Record<Environment, EnvironmentConfig> = {
  development: {
    scheme: "convos-dev",
    ios: {
      bundleIdentifier: "com.convos.dev",
      // For now use preview domain for dev
      associatedDomains: [
        "applinks:preview.convos.org",
        "applinks:*.preview.convos.org",
        "webcredentials:preview.convos.org",
        "webcredentials:*.preview.convos.org",
      ],
      googleServicesFile: "./google-services/google-services-ios-dev.plist",
      icon: {
        dark: "./assets/icon-dark.png",
        light: "./assets/icon-light.png",
        tinted: "./assets/icon-tinted.png",
      },
    },
    android: {
      package: "com.convos.dev",
      googleServicesFile: "./google-services/google-services-android-dev.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
    },
    // For now use preview domain for dev
    webDomain: "preview.convos.org",
    appName: "Convos Dev",
    icon: "./assets/icon-light.png",
  },
  preview: {
    scheme: "convos-preview",
    ios: {
      bundleIdentifier: "com.convos.preview",
      associatedDomains: [
        "applinks:preview.convos.org",
        "applinks:*.preview.convos.org",
        "webcredentials:preview.convos.org",
        "webcredentials:*.preview.convos.org",
      ],
      googleServicesFile: "./google-services/google-services-ios-preview.plist",
      icon: {
        dark: "./assets/icon-dark.png",
        light: "./assets/icon-light.png",
        tinted: "./assets/icon-tinted.png",
      },
    },
    android: {
      package: "com.convos.preview",
      googleServicesFile: "./google-services/google-services-android-preview.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
    },
    webDomain: "preview.convos.org",
    appName: "Convos Preview",
    icon: "./assets/icon-light.png",
  },
  production: {
    scheme: "convos",
    ios: {
      bundleIdentifier: "com.convos.prod",
      associatedDomains: [
        "applinks:convos.org",
        "applinks:*.convos.org",
        "webcredentials:convos.org",
        "webcredentials:*.convos.org",
      ],
      googleServicesFile: "./google-services/google-services-ios-prod.plist",
      icon: {
        dark: "./assets/icon-dark.png",
        light: "./assets/icon-light.png",
        tinted: "./assets/icon-tinted.png",
      },
    },
    android: {
      package: "com.convos.prod",
      googleServicesFile: "./google-services/google-services-android-prod.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
    },
    webDomain: "convos.org",
    appName: "Convos",
    icon: "./assets/icon-light.png",
  },
}

export default () => {
  const expoEnv = (process.env.EXPO_ENV || "development") as Environment
  const config = settings[expoEnv]

  return {
    name: config.appName,
    scheme: config.scheme,
    owner: "ephemera",
    slug: "convos",
    orientation: "portrait",
    icon: config.icon,
    userInterfaceStyle: "automatic",
    version: version,
    assetBundlePatterns: ["**/*"],
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      url: "https://u.expo.dev/f9089dfa-8871-4aff-93ea-da08af0370d2",
    },
    extra: {
      webDomain: config.webDomain,
      expoEnv,
      eas: {
        projectId: "f9089dfa-8871-4aff-93ea-da08af0370d2",
      },
    },
    ios: {
      bundleIdentifier: config.ios.bundleIdentifier,
      supportsTablet: true,
      associatedDomains: config.ios.associatedDomains,
      googleServicesFile: config.ios.googleServicesFile,
      icon: config.ios.icon,
      config: {
        usesNonExemptEncryption: false,
      },
      entitlements: {
        // App check stuff
        "com.apple.developer.devicecheck.appattest-environment": "production",
      },
      infoPlist: {
        LSApplicationQueriesSchemes: [
          "cbwallet",
          "rainbow",
          "metamask",
          "trust",
          "uniswap",
          "zerion",
          "exodus",
          "oneinch",
          "phantom",
          "app.phantom",
        ],
        NSAppTransportSecurity: {
          // For local development
          NSAllowsLocalNetworking: true,
        },
        UIBackgroundModes: ["remote-notification", "fetch", "processing"],
        BGTaskSchedulerPermittedIdentifiers: [
          "com.convos.background-notification",
          "com.convos.background-fetch",
          "com.convos.background-processing",
        ],
      },
    },
    android: {
      package: config.android.package,
      googleServicesFile: config.android.googleServicesFile,
      intentFilters: [
        {
          action: "VIEW",
          category: ["DEFAULT", "BROWSABLE"],
          data: [{ scheme: config.scheme }, { scheme: config.android.package }],
        },
        {
          autoVerify: true,
          action: "VIEW",
          category: ["DEFAULT", "BROWSABLE"],
          data: [
            {
              scheme: "https",
              host: config.webDomain,
              pathPrefix: "/coinbase",
            },
            {
              scheme: "https",
              host: config.webDomain,
              pathPrefix: "/",
            },
            {
              scheme: "https",
              host: config.webDomain,
              pathPrefix: "/dm",
            },
            {
              scheme: "https",
              host: config.webDomain,
              pathPrefix: "/group-invite",
            },
            {
              scheme: "https",
              host: config.webDomain,
              pathPrefix: "/group",
            },
          ],
        },
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
    },
    plugins: [
      [
        "expo-notifications",
        {
          enableBackgroundRemoteNotifications: true,
        },
      ],
      ["expo-secure-store"],
      [
        "expo-local-authentication",
        {
          faceIDPermission: "We need this to use biometrics to secure your data.",
        },
      ],
      [
        "expo-build-properties",
        {
          ios: {
            // To fix error "The Swift pod `FirebaseCoreInternal` depends upon `GoogleUtilities`,
            // which does not define modules. To opt into those targets generating module maps
            // (which is necessary to import them from Swift when building as static libraries),
            // you may set `use_modular_headers!` globally in your Podfile,
            // or specify `:modular_headers => true` for particular dependencies"
            useFrameworks: "static",
            deploymentTarget: "16.0",
          },
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 34,
            buildToolsVersion: "34.0.0",
            minSdkVersion: 26,
            manifestQueries: {
              // Required for Coinbase Wallet integration
              package: ["org.toshi"],
              // Define supported wallet deep links that our app can open
              // This allows Android to show our app as an option when users click wallet links
              intent: [
                {
                  action: "VIEW",
                  data: {
                    scheme: "cbwallet",
                    host: "*",
                  },
                },
                {
                  action: "VIEW",
                  data: {
                    scheme: "ledgerlive",
                    host: "*",
                  },
                },
                {
                  action: "VIEW",
                  data: {
                    scheme: "rainbow",
                    host: "*",
                  },
                },
                {
                  action: "VIEW",
                  data: {
                    scheme: "metamask",
                    host: "*",
                  },
                },
                {
                  action: "VIEW",
                  data: {
                    scheme: "trust",
                    host: "*",
                  },
                },
                {
                  action: "VIEW",
                  data: {
                    scheme: "uniswap",
                    host: "*",
                  },
                },
                {
                  action: "VIEW",
                  data: {
                    scheme: "zerion",
                    host: "*",
                  },
                },
                {
                  action: "VIEW",
                  data: {
                    scheme: "exodus",
                    host: "*",
                  },
                },
                {
                  action: "VIEW",
                  data: {
                    scheme: "oneinch",
                    host: "*",
                  },
                },
              ],
            },
          },
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "We need this so that you can share photos from your library.",
          cameraPermission: "We need this so that you can take photos to share.",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon-light.png",
          backgroundColor: "#FFFFFF",
          dark: {
            image: "./assets/splash-icon-dark.png",
            backgroundColor: "#000000",
          },
          imageWidth: 200,
        },
      ],
      [
        "@sentry/react-native/expo",
        {
          organization: "ephemerahq",
          project: "convos-app-react-native",
          url: "https://sentry.io/",
        },
      ],
      ["@react-native-firebase/app"],
      ["@react-native-firebase/app-check"],
      "./scripts/android/build/android-deps-expo-plugin.js",
    ],
  } as ICustomExpoConfig
}
