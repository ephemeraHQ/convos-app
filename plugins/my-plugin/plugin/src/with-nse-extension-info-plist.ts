import fs from "fs"
import path from "path"
import plist from "@expo/plist"
import { withInfoPlist, type ConfigPlugin, type InfoPlist } from "expo/config-plugins"
import { getAppBundleIdentifier, getAppGroup, getShareExtensionName } from "./helpers/utils"

export const withNSEInfoPlist: ConfigPlugin = (config) => {
  return withInfoPlist(config, (config) => {
    console.log("Starting withNSEInfoPlist")
    const targetName = getShareExtensionName(config)

    const targetPath = path.join(config.modRequest.platformProjectRoot, targetName)

    const filePath = path.join(targetPath, "Info.plist")

    const bundleIdentifier = getAppBundleIdentifier(config)
    const appGroup = getAppGroup(bundleIdentifier)

    let infoPlist: InfoPlist = {
      CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
      CFBundleDisplayName: "$(PRODUCT_NAME) Share Extension",
      CFBundleExecutable: "$(EXECUTABLE_NAME)",
      CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
      CFBundleInfoDictionaryVersion: "6.0",
      CFBundleName: "$(PRODUCT_NAME)",
      CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
      CFBundleShortVersionString: "$(MARKETING_VERSION)",
      CFBundleVersion: "$(CURRENT_PROJECT_VERSION)",
      LSRequiresIPhoneOS: true,
      NSAppTransportSecurity: {
        NSExceptionDomains: {
          localhost: {
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
      UIRequiredDeviceCapabilities: ["armv7"],
      UIStatusBarStyle: "UIStatusBarStyleDefault",
      UISupportedInterfaceOrientations: [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
      ],
      UIUserInterfaceStyle: "Automatic",
      UIViewControllerBasedStatusBarAppearance: false,
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: true,
        UISceneConfigurations: {},
      },
      // we need to add an AppGroup key for compatibility with react-native-mmkv https://github.com/mrousavy/react-native-mmkv
      AppGroup: appGroup,
      HostAppScheme: config.scheme,
    }

    fs.mkdirSync(path.dirname(filePath), {
      recursive: true,
    })
    fs.writeFileSync(filePath, plist.build(infoPlist))

    console.log("Finished withNSEInfoPlist")

    return config
  })
}
