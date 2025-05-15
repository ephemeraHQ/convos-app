import assert from "assert"
import * as fs from "fs"
import * as path from "path"
import { ConfigPlugin, InfoPlist, withDangerousMod, withXcodeProject } from "@expo/config-plugins"
import plist from "@expo/plist"
import { FileManager } from "./FileManager"
import {
  APP_GROUP_KEY,
  DEFAULT_BUNDLE_SHORT_VERSION,
  DEFAULT_BUNDLE_VERSION,
  IOS_TEAM_ID,
  IPHONEOS_DEPLOYMENT_TARGET,
  NSE_EXT_FILES,
  NSE_INFO_PLIST_FILE_NAME,
  NSE_SWIFT_SOURCE_FILES,
  NSE_TARGET_NAME,
  PLUGIN_SWIFT_PATH,
  TARGETED_DEVICE_FAMILY,
} from "./iosConstants"
import { Log } from "./Log"

const withNseFilesAndPlistMods: ConfigPlugin = (config) => {
  assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.")
  const appGroupId = `group.${config.ios.bundleIdentifier}`
  const keychainGroup = `$(AppIdentifierPrefix)${appGroupId}` // Prefix needed for keychain-access-groups
  const KEYCHAIN_ACCESS_GROUP_KEY = "keychain-access-groups"
  const targetName = NSE_TARGET_NAME
  const entitlementsFilename = `${targetName}.entitlements`
  const infoPlistFilename = NSE_INFO_PLIST_FILE_NAME // Already defined in constants

  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const sourceDir = path.join(config.modRequest.projectRoot, PLUGIN_SWIFT_PATH)
      const platformProjectRoot = config.modRequest.platformProjectRoot
      const nseDir = path.join(platformProjectRoot, targetName)

      Log.log(`Ensuring NSE directory exists: ${nseDir}`)
      fs.mkdirSync(nseDir, { recursive: true })

      Log.log(`Copying NSE template files from ${sourceDir} to ${nseDir}`)
      /* --- COPY ALL FILES --- */
      // Copy Swift files
      for (const sourceFileName of NSE_SWIFT_SOURCE_FILES) {
        const sourcePath = path.join(sourceDir, sourceFileName)
        const targetFile = path.join(nseDir, sourceFileName)
        await FileManager.copyFile(sourcePath, targetFile)
      }
      // Copy plist and entitlements templates
      for (const extFile of NSE_EXT_FILES) {
        const targetFile = path.join(nseDir, extFile)
        const src = path.join(sourceDir, extFile)
        await FileManager.copyFile(src, targetFile)
      }
      /* --- END COPY ALL FILES --- */

      /* --- MODIFY ENTITLEMENTS --- */
      const entitlementsPath = path.join(nseDir, entitlementsFilename)
      Log.log(`Attempting to modify NSE entitlements file at: ${entitlementsPath}`)
      if (fs.existsSync(entitlementsPath)) {
        let entitlements

        try {
          entitlements = plist.parse(fs.readFileSync(entitlementsPath, "utf8"))
          entitlements = entitlements || {} // Ensure entitlements is an object

          // Add App Group
          if (!Array.isArray(entitlements[APP_GROUP_KEY])) entitlements[APP_GROUP_KEY] = []
          const appGroups = entitlements[APP_GROUP_KEY] as Array<string>
          if (!appGroups.includes(appGroupId)) {
            Log.log(`Adding App Group '${appGroupId}' to NSE entitlements.`)
            appGroups.push(appGroupId)
          }

          // Add Keychain Access Group
          if (!Array.isArray(entitlements[KEYCHAIN_ACCESS_GROUP_KEY]))
            entitlements[KEYCHAIN_ACCESS_GROUP_KEY] = []
          const keychainGroups = entitlements[KEYCHAIN_ACCESS_GROUP_KEY] as Array<string>
          if (!keychainGroups.includes(keychainGroup)) {
            Log.log(`Adding Keychain Group '${keychainGroup}' to NSE entitlements.`)
            keychainGroups.push(keychainGroup)
            // Add default group too, might be needed sometimes
            const defaultKeychainGroup = `$(AppIdentifierPrefix)${config.ios?.bundleIdentifier}.${targetName}`
            if (!keychainGroups.includes(defaultKeychainGroup)) {
              keychainGroups.push(defaultKeychainGroup)
            }
          }

          // Add APS Environment if needed for NSE specifically
          entitlements["aps-environment"] = "production"

          fs.writeFileSync(entitlementsPath, plist.build(entitlements))
          Log.log(`Successfully updated ${entitlementsFilename}`)
        } catch (e: any) {
          Log.log(`Error processing NSE entitlements plist: ${e.message}.`)
        }
      } else {
        Log.log(
          `NSE entitlements file not found at ${entitlementsPath} after copy. Skipping modification.`,
        )
      }
      /* --- END MODIFY ENTITLEMENTS --- */

      /* --- MODIFY INFO.PLIST --- */
      const infoPlistPath = path.join(nseDir, infoPlistFilename)
      Log.log(`Attempting to modify NSE Info.plist at: ${infoPlistPath}`)
      if (fs.existsSync(infoPlistPath)) {
        let infoPlistContents: InfoPlist
        try {
          infoPlistContents = plist.parse(fs.readFileSync(infoPlistPath, "utf8")) as InfoPlist

          // Update Bundle Versions
          const bundleVersion = config.ios?.buildNumber ?? DEFAULT_BUNDLE_VERSION
          const shortVersion = config.version ?? DEFAULT_BUNDLE_SHORT_VERSION
          Log.log(`Setting CFBundleVersion to ${bundleVersion} in ${infoPlistFilename}`)
          infoPlistContents.CFBundleVersion = bundleVersion
          Log.log(`Setting CFBundleShortVersionString to ${shortVersion} in ${infoPlistFilename}`)
          infoPlistContents.CFBundleShortVersionString = shortVersion

          // Set XMTP Environment
          const expoEnv =
            process.env.EXPO_ENV?.toLowerCase() || config.extra?.expoEnv || "development"
          let xmtpEnvironment = "local"
          if (expoEnv === "production") xmtpEnvironment = "production"
          else if (expoEnv === "preview") xmtpEnvironment = "dev"
          else if (expoEnv === "development") xmtpEnvironment = "local"
          Log.log(`Setting XmtpEnvironment in ${infoPlistFilename} to: ${xmtpEnvironment}`)
          infoPlistContents.XmtpEnvironment = xmtpEnvironment

          // Set App Group Identifier
          Log.log(`Setting AppGroupIdentifier in ${infoPlistFilename} to: ${appGroupId}`)
          infoPlistContents.AppGroupIdentifier = appGroupId

          // Set Main App Bundle Identifier
          Log.log(
            `Setting MainAppBundleIdentifier in ${infoPlistFilename} to: ${config.ios?.bundleIdentifier}`,
          )
          infoPlistContents.MainAppBundleIdentifier = config.ios?.bundleIdentifier

          fs.writeFileSync(infoPlistPath, plist.build(infoPlistContents))
          Log.log(`Successfully updated ${infoPlistFilename}`)
        } catch (e: any) {
          Log.log(`Error processing NSE Info.plist: ${e.message}.`)
        }
      } else {
        Log.log(`NSE Info.plist not found at ${infoPlistPath} after copy. Skipping modification.`)
      }
      /* --- END MODIFY INFO.PLIST --- */

      return config
    },
  ])
}

const withXcodeProjectSettings: ConfigPlugin = (config) => {
  return withXcodeProject(config, (newConfig) => {
    const xcodeProject = newConfig.modResults

    // Construct the dynamic App Group ID again here if needed for checks, or rely on config
    assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.")
    const entitlementsFilename = `${NSE_TARGET_NAME}.entitlements`

    if (!!xcodeProject.pbxTargetByName(NSE_TARGET_NAME)) {
      Log.log(`${NSE_TARGET_NAME} target already exists in project. Skipping...`)
      // Optionally add checks here to ensure existing target has correct App Group
      return newConfig
    }

    // Create new PBXGroup for the extension
    const extGroup = xcodeProject.addPbxGroup(
      [...NSE_EXT_FILES, ...NSE_SWIFT_SOURCE_FILES],
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
    xcodeProject.addBuildPhase(
      NSE_SWIFT_SOURCE_FILES,
      "PBXSourcesBuildPhase",
      "Sources",
      nseTarget.uuid,
    )
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
        buildSettingsObj.CODE_SIGN_ENTITLEMENTS = `${NSE_TARGET_NAME}/${entitlementsFilename}` // Use variable
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

const withPodfile: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile")
      let podfileContent = fs.readFileSync(podfilePath).toString()

      // Check if the target already exists to avoid duplicates
      if (podfileContent.includes(`target '${NSE_TARGET_NAME}'`)) {
        Log.log(`${NSE_TARGET_NAME} target already exists in Podfile. Skipping...`)
        return config
      }

      const nseTargetBlock = `

target '${NSE_TARGET_NAME}' do
  # Use the iOS XMTP version required by the installed @xmtp/react-native-sdk
  # Same value that we use in the react-native app
  pod 'XMTP', '4.2.0-dev.b10e719', :modular_headers => true
  # Same value that we use in the react-native app
  pod 'MMKV', '~> 2.2.1', :modular_headers => true

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
  // 1. Copy files AND modify copied entitlements/Info.plist
  config = withNseFilesAndPlistMods(config)
  // 2. Set up the Xcode project target, linking files and setting build settings
  config = withXcodeProjectSettings(config, props)
  // 3. Modify the Podfile
  config = withPodfile(config)

  // Optional: These might modify main app settings/entitlements if needed
  // config = withAppEnvironment(config, props);
  // config = withEasManagedCredentials(config, props);

  return config
}
