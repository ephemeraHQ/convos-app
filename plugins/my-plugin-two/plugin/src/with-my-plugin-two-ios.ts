/**
 * Expo config plugin for copying NSE to XCode
 */

import assert from "assert"
import * as fs from "fs"
import * as path from "path"
import {
  ConfigPlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
} from "@expo/config-plugins"
import { ExpoConfig } from "@expo/config-types"
import getEasManagedCredentialsConfigExtra from "./eas/getEasManagedCredentialsConfigExtra"
import { FileManager } from "./FileManager"
import {
  DEFAULT_BUNDLE_SHORT_VERSION,
  DEFAULT_BUNDLE_VERSION,
  IPHONEOS_DEPLOYMENT_TARGET,
  NSE_EXT_FILES,
  NSE_SOURCE_FILES,
  NSE_TARGET_NAME,
  TARGETED_DEVICE_FAMILY,
} from "./iosConstants"
import { Log } from "./Log"
import NseUpdaterManager from "./NseUpdaterManager"

/**
 * Add 'aps-environment' record with current environment to '<project-name>.entitlements' file
 * @see https://documentation.onesignal.com/docs/react-native-sdk-setup#step-4-install-for-ios-using-cocoapods-for-ios-apps
 */
const withAppEnvironment: ConfigPlugin = (config) => {
  return withEntitlementsPlist(config, (newConfig) => {
    //   if (onesignalProps?.mode == null) {
    //     throw new Error(`
    //       Missing required "mode" key in your app.json or app.config.js file for "expo-notification-service-extension-plugin".
    //       "mode" can be either "development" or "production".
    //       Please see expo-notification-service-extension-plugin's README.md for more details.`
    //     )
    //   }
    //   if (onesignalProps?.iosNSEFilePath == null) {
    //     throw new Error(`
    //       Missing required "iosNSEFilePath" key in your app.json or app.config.js file for "expo-notification-service-extension-plugin".
    //       "iosNSEFilePath" must point to a local Notification Service file written in objective-c.
    //       Please see expo-notification-service-extension-plugin's README.md for more details.`
    //     )
    //   }
    newConfig.modResults["aps-environment"] = "production"
    return newConfig
  })
}

/**
 * Add "App Group" permission
 * @see https://documentation.onesignal.com/docs/react-native-sdk-setup#step-4-install-for-ios-using-cocoapods-for-ios-apps (step 4.4)
 */
const withAppGroupPermissions: ConfigPlugin = (config) => {
  const APP_GROUP_KEY = "com.apple.security.application-groups"
  return withEntitlementsPlist(config, (newConfig) => {
    if (!Array.isArray(newConfig.modResults[APP_GROUP_KEY])) {
      newConfig.modResults[APP_GROUP_KEY] = []
    }
    const modResultsArray = newConfig.modResults[APP_GROUP_KEY] as Array<any>
    const entitlement = `group.${newConfig?.ios?.bundleIdentifier || ""}.nse`
    if (modResultsArray.indexOf(entitlement) !== -1) {
      return newConfig
    }
    modResultsArray.push(entitlement)

    return newConfig
  })
}

const withEasManagedCredentials: ConfigPlugin = (config) => {
  assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.")
  config.extra = getEasManagedCredentialsConfigExtra(config as ExpoConfig)
  return config
}

const withOneSignalNSE: ConfigPlugin = (config, props) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const sourceDir = path.join(
        config.modRequest.projectRoot,
        "plugins/my-plugin-two/plugin/swift",
      )
      console.log("sourceDir:", sourceDir)
      const iosPath = path.join(config.modRequest.projectRoot, "ios")

      /* COPY OVER EXTENSION FILES */
      fs.mkdirSync(`${iosPath}/${NSE_TARGET_NAME}`, { recursive: true })

      for (let i = 0; i < NSE_EXT_FILES.length; i++) {
        const extFile = NSE_EXT_FILES[i]
        const targetFile = `${iosPath}/${NSE_TARGET_NAME}/${extFile}`
        const src = path.join(sourceDir, extFile)
        console.log("src:", src)
        console.log("targetFile:", targetFile)
        await FileManager.copyFile(`${src}`, targetFile)
      }

      // Copy NSE source file either from configuration-provided location, falling back to the default one.
      for (let i = 0; i < NSE_SOURCE_FILES.length; i++) {
        const sourceFileName = NSE_SOURCE_FILES[i]
        console.log("sourceFile:", sourceFileName)
        const sourcePath = `${sourceDir}/${sourceFileName}`
        console.log("sourcePath:", sourcePath)
        const targetFile = `${iosPath}/${NSE_TARGET_NAME}/${sourceFileName}`
        await FileManager.copyFile(`${sourcePath}`, targetFile)
      }

      /* MODIFY COPIED EXTENSION FILES */
      const nseUpdater = new NseUpdaterManager(iosPath)
      await nseUpdater.updateNSEBundleVersion(config.ios?.buildNumber ?? DEFAULT_BUNDLE_VERSION)
      await nseUpdater.updateNSEBundleShortVersion(config?.version ?? DEFAULT_BUNDLE_SHORT_VERSION)

      return config
    },
  ])
}

const withOneSignalXcodeProject: ConfigPlugin = (config, props) => {
  return withXcodeProject(config, (newConfig) => {
    const xcodeProject = newConfig.modResults

    if (!!xcodeProject.pbxTargetByName(NSE_TARGET_NAME)) {
      Log.log(`${NSE_TARGET_NAME} already exists in project. Skipping...`)
      return newConfig
    }

    // Create new PBXGroup for the extension
    const extGroup = xcodeProject.addPbxGroup(
      [...NSE_EXT_FILES, ...NSE_SOURCE_FILES],
      NSE_TARGET_NAME,
      NSE_TARGET_NAME,
    )

    // Add the new PBXGroup to the top level group. This makes the
    // files / folder appear in the file explorer in Xcode.
    const groups = xcodeProject.hash.project.objects["PBXGroup"]
    Object.keys(groups).forEach(function (key) {
      if (
        typeof groups[key] === "object" &&
        groups[key].name === undefined &&
        groups[key].path === undefined
      ) {
        xcodeProject.addToPbxGroup(extGroup.uuid, key)
      }
    })

    // WORK AROUND for codeProject.addTarget BUG
    // Xcode projects don't contain these if there is only one target
    // An upstream fix should be made to the code referenced in this link:
    //   - https://github.com/apache/cordova-node-xcode/blob/8b98cabc5978359db88dc9ff2d4c015cba40f150/lib/pbxProject.js#L860
    const projObjects = xcodeProject.hash.project.objects
    projObjects["PBXTargetDependency"] = projObjects["PBXTargetDependency"] || {}
    projObjects["PBXContainerItemProxy"] = projObjects["PBXTargetDependency"] || {}

    // Add the NSE target
    // This adds PBXTargetDependency and PBXContainerItemProxy for you
    const nseTarget = xcodeProject.addTarget(
      NSE_TARGET_NAME,
      "app_extension",
      NSE_TARGET_NAME,
      `${config.ios?.bundleIdentifier}.${NSE_TARGET_NAME}`,
    )

    // Add build phases to the new target
    xcodeProject.addBuildPhase(NSE_SOURCE_FILES, "PBXSourcesBuildPhase", "Sources", nseTarget.uuid)
    xcodeProject.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", nseTarget.uuid)

    xcodeProject.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", nseTarget.uuid)

    // Edit the Deployment info of the new Target, only IphoneOS and Targeted Device Family
    // However, can be more
    const configurations = xcodeProject.pbxXCBuildConfigurationSection()
    for (const key in configurations) {
      if (
        typeof configurations[key].buildSettings !== "undefined" &&
        configurations[key].buildSettings.PRODUCT_NAME == `"${NSE_TARGET_NAME}"`
      ) {
        const buildSettingsObj = configurations[key].buildSettings
        buildSettingsObj.DEVELOPMENT_TEAM = "FY4NZR34Z3"
        buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET = IPHONEOS_DEPLOYMENT_TARGET
        buildSettingsObj.TARGETED_DEVICE_FAMILY = TARGETED_DEVICE_FAMILY
        buildSettingsObj.CODE_SIGN_ENTITLEMENTS = `${NSE_TARGET_NAME}/${NSE_TARGET_NAME}.entitlements`
        buildSettingsObj.CODE_SIGN_STYLE = "Automatic"
        buildSettingsObj.SWIFT_VERSION = "5.0"
      }
    }

    // Add development teams to both your target and the original project
    xcodeProject.addTargetAttribute("DevelopmentTeam", "FY4NZR34Z3", nseTarget)
    xcodeProject.addTargetAttribute("DevelopmentTeam", "FY4NZR34Z3")
    return newConfig
  })
}

export const withMyPluginTwoIos: ConfigPlugin = (config, props) => {
  config = withAppEnvironment(config, props)
  config = withAppGroupPermissions(config, props)
  config = withOneSignalNSE(config, props)
  config = withOneSignalXcodeProject(config, props)
  config = withEasManagedCredentials(config, props)
  return config
}
