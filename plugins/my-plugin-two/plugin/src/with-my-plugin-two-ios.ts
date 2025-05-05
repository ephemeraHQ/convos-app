/**
 * Expo config plugin for copying NSE to XCode
 */

import assert from "assert"
import * as fs from "fs"
import * as path from "path"
import {
  ConfigPlugin,
  InfoPlist,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} from "@expo/config-plugins"
import { ExpoConfig } from "@expo/config-types"
import plist from "@expo/plist"
import getEasManagedCredentialsConfigExtra from "./eas/getEasManagedCredentialsConfigExtra"
import { FileManager } from "./FileManager"
import {
  APP_GROUP_KEY,
  DEFAULT_BUNDLE_SHORT_VERSION,
  DEFAULT_BUNDLE_VERSION,
  IOS_TEAM_ID,
  IPHONEOS_DEPLOYMENT_TARGET,
  NSE_EXT_FILES,
  NSE_INFO_PLIST_FILE_NAME,
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
    newConfig.modResults["aps-environment"] = "production" // Assuming always production for APS
    return newConfig
  })
}

/**
 * Add environment-specific "App Group" permission to the NSE entitlements.
 */
const withAppGroupPermissions: ConfigPlugin = (config) => {
  // Construct the dynamic App Group ID based on the main app's bundle identifier
  assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.")
  const appGroupId = `group.${config.ios.bundleIdentifier}`

  return withEntitlementsPlist(config, (newConfig) => {
    // Initialize the array if it doesn't exist in the NSE entitlements
    if (!Array.isArray(newConfig.modResults[APP_GROUP_KEY])) {
      newConfig.modResults[APP_GROUP_KEY] = []
    }

    const modResultsArray = newConfig.modResults[APP_GROUP_KEY] as Array<string>

    // Check if the correct dynamic group ID is already present
    if (modResultsArray.includes(appGroupId)) {
      Log.log(`App Group '${appGroupId}' already present in NSE entitlements. Skipping addition.`)
      return newConfig
    }

    // Add the correct dynamic group ID
    Log.log(`Adding App Group '${appGroupId}' to NSE entitlements.`)
    modResultsArray.push(appGroupId)

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
      const iosPath = path.join(config.modRequest.projectRoot, "ios")

      /* COPY OVER EXTENSION FILES */
      fs.mkdirSync(`${iosPath}/${NSE_TARGET_NAME}`, { recursive: true })

      for (let i = 0; i < NSE_EXT_FILES.length; i++) {
        const extFile = NSE_EXT_FILES[i]
        const targetFile = `${iosPath}/${NSE_TARGET_NAME}/${extFile}`
        const src = path.join(sourceDir, extFile)
        await FileManager.copyFile(`${src}`, targetFile)
      }

      // Copy NSE source file either from configuration-provided location, falling back to the default one.
      for (let i = 0; i < NSE_SOURCE_FILES.length; i++) {
        const sourceFileName = NSE_SOURCE_FILES[i]
        const sourcePath = `${sourceDir}/${sourceFileName}`
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

    // Construct the dynamic App Group ID again here if needed for checks, or rely on config
    assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.")
    const appGroupId = `group.${config.ios.bundleIdentifier}` // Needed for potential checks/logging

    if (!!xcodeProject.pbxTargetByName(NSE_TARGET_NAME)) {
      Log.log(`${NSE_TARGET_NAME} already exists in project. Skipping...`)
      // Optionally add checks here to ensure existing target has correct App Group
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
    const projObjects = xcodeProject.hash.project.objects
    projObjects["PBXTargetDependency"] = projObjects["PBXTargetDependency"] || {}
    projObjects["PBXContainerItemProxy"] = projObjects["PBXTargetDependency"] || {}

    // Add the NSE target
    const nseTarget = xcodeProject.addTarget(
      NSE_TARGET_NAME,
      "app_extension",
      NSE_TARGET_NAME,
      // Use the correct NSE bundle identifier pattern if it differs from main app + NSE_TARGET_NAME
      // Example assumes: com.example.app.ConvosNSE
      `${config.ios?.bundleIdentifier}.${NSE_TARGET_NAME}`,
    )

    // Add build phases to the new target
    xcodeProject.addBuildPhase(NSE_SOURCE_FILES, "PBXSourcesBuildPhase", "Sources", nseTarget.uuid)
    xcodeProject.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", nseTarget.uuid)
    xcodeProject.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", nseTarget.uuid)

    // Edit the Deployment info of the new Target
    const configurations = xcodeProject.pbxXCBuildConfigurationSection()
    for (const key in configurations) {
      const buildConfig = configurations[key]
      // Ensure we are modifying the NSE target's configurations
      if (buildConfig.buildSettings?.PRODUCT_NAME === `"${NSE_TARGET_NAME}"`) {
        const buildSettingsObj = buildConfig.buildSettings
        buildSettingsObj.DEVELOPMENT_TEAM = IOS_TEAM_ID // Use teamId from config if available
        buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET = IPHONEOS_DEPLOYMENT_TARGET
        buildSettingsObj.TARGETED_DEVICE_FAMILY = TARGETED_DEVICE_FAMILY
        // Ensure entitlements path is correct relative to the project structure
        buildSettingsObj.CODE_SIGN_ENTITLEMENTS = `${NSE_TARGET_NAME}/${NSE_TARGET_NAME}.entitlements`
        buildSettingsObj.CODE_SIGN_STYLE = "Automatic"
        buildSettingsObj.SWIFT_VERSION = "5.0" // Ensure this matches your Swift version
      }
    }

    // Add development teams to both your target and the original project
    xcodeProject.addTargetAttribute("DevelopmentTeam", IOS_TEAM_ID, nseTarget)
    xcodeProject.addTargetAttribute("DevelopmentTeam", IOS_TEAM_ID) // For the main target

    return newConfig
  })
}

/**
 * Writes environment-specific settings (XMTP Env, App Group ID) to the NSE's Info.plist.
 */
const withNseInfoPlist: ConfigPlugin = (config) => {
  // Construct the dynamic App Group ID
  assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.")
  const appGroupId = `group.${config.ios.bundleIdentifier}`

  return withInfoPlist(config, (config) => {
    const targetName = NSE_TARGET_NAME
    const nsePlistPath = path.join(
      config.modRequest.platformProjectRoot,
      targetName,
      NSE_INFO_PLIST_FILE_NAME,
    )

    Log.log(`Attempting to modify NSE Info.plist at: ${nsePlistPath}`)

    let nsePlistContents: InfoPlist
    try {
      nsePlistContents = plist.parse(fs.readFileSync(nsePlistPath, "utf8"))
    } catch (e: any) {
      Log.log(`Error parsing NSE Info.plist: ${e.message}. Skipping modification.`)
      return config
    }

    // --- Set XMTP Environment ---
    const expoEnv = process.env.EXPO_ENV?.toLowerCase() || config.extra?.expoEnv || "development"
    let xmtpEnvironment = "local"

    if (expoEnv === "production") {
      xmtpEnvironment = "production"
    } else if (expoEnv === "preview") {
      xmtpEnvironment = "dev" // Keep preview on dev for XMTP
    } else if (expoEnv === "development") {
      xmtpEnvironment = "local"
    }

    Log.log(
      `Setting XmtpEnvironment in ${targetName}/${NSE_INFO_PLIST_FILE_NAME} to: ${xmtpEnvironment}`,
    )
    nsePlistContents.XmtpEnvironment = xmtpEnvironment

    // --- Set App Group Identifier ---
    Log.log(
      `Setting AppGroupIdentifier in ${targetName}/${NSE_INFO_PLIST_FILE_NAME} to: ${appGroupId}`,
    )
    nsePlistContents.AppGroupIdentifier = appGroupId // Use a distinct key

    try {
      fs.writeFileSync(nsePlistPath, plist.build(nsePlistContents))
      Log.log(`Successfully updated ${targetName}/${NSE_INFO_PLIST_FILE_NAME}`)
    } catch (e: any) {
      Log.log(`Error writing updated ${targetName}/${NSE_INFO_PLIST_FILE_NAME}: ${e.message}`)
    }

    return config
  })
}

const withPodfile: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile")
      let podfileContent = fs.readFileSync(podfilePath).toString()

      // Check if the target already exists to avoid duplicates
      if (podfileContent.includes(`target '${NSE_TARGET_NAME}'`)) {
        Log.log(`${NSE_TARGET_NAME} target already exists in Podfile. Skipping...`)
        // Even if skipping, ensure the version inside is correct (optional robustness)
        // This part is more complex, might be better to just ensure clean state first
        return config
      }

      // Use the version required by @xmtp/react-native-sdk@4.0.5
      // TODO: Dynamically read this from package.json if possible
      const requiredXmtpVersion = "4.0.7"

      const nseTargetBlock = `

target '${NSE_TARGET_NAME}' do
  # Use the version required by the installed @xmtp/react-native-sdk
  pod 'XMTP', '${requiredXmtpVersion}', :modular_headers => true

  # NSEs often use static frameworks. Adjust if your setup differs.
  use_frameworks! :linkage => :static
end
`

      // Append the new target block to the end of the file
      podfileContent += nseTargetBlock

      fs.writeFileSync(podfilePath, podfileContent)

      return config
    },
  ])
}

export const withMyPluginTwoIos: ConfigPlugin = (config, props) => {
  config = withAppEnvironment(config, props) // Keep this if needed for APS env
  config = withAppGroupPermissions(config, props) // Now uses dynamic group ID
  config = withOneSignalNSE(config, props)
  config = withOneSignalXcodeProject(config, props)
  config = withNseInfoPlist(config) // Now writes dynamic group ID to plist
  config = withPodfile(config)
  config = withEasManagedCredentials(config, props)
  return config
}
