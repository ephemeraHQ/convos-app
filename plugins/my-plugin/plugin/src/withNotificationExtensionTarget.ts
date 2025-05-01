import fs from "fs"
import path from "path"
import { withXcodeProject, type ConfigPlugin } from "@expo/config-plugins"
import { findNativeTargetByName } from "@expo/config-plugins/build/ios/Target"
import { addBuildSourceFileToGroup } from "@expo/config-plugins/build/ios/utils/Xcodeproj"
import { DEPLOYMENT_TARGET, EXTENSION_NAME, INFO_PLIST_FILENAME, PRODUCT_TYPE } from "./constants"

export const withNotificationExtensionTarget: ConfigPlugin = (config) => {
  return withXcodeProject(config, (mod) => {
    const xcodeProject = mod.modResults

    // Skip if the target already exists
    try {
      findNativeTargetByName(xcodeProject, EXTENSION_NAME)
      return mod
    } catch {}

    const bundleId = `${config.ios!.bundleIdentifier}.${EXTENSION_NAME.toLowerCase()}`

    // Create a PBX group for the extension sources
    const group = xcodeProject.addPbxGroup([], EXTENSION_NAME, EXTENSION_NAME)
    const mainGroupKey = xcodeProject.getFirstProject().firstProject.mainGroup
    xcodeProject.getPBXGroupByKey(mainGroupKey).children.push({
      value: group.uuid,
      comment: EXTENSION_NAME,
    })

    console.log("bundleId:", bundleId)

    // Add a new target
    const target = xcodeProject.addTarget(EXTENSION_NAME, PRODUCT_TYPE, EXTENSION_NAME, bundleId)

    // Add files to the build phase
    const files = fs
      .readdirSync(path.join(mod.modRequest.platformProjectRoot, EXTENSION_NAME))
      .map((f) => path.join(EXTENSION_NAME, f))

    files.forEach((filePath) =>
      addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: EXTENSION_NAME,
        project: xcodeProject,
        verbose: false,
        targetUuid: target.uuid,
      }),
    )

    // Empty resources phase (needed so Info.plist is packaged)
    xcodeProject.addBuildPhase(
      [],
      "PBXResourcesBuildPhase",
      "Resources",
      target.uuid,
      EXTENSION_NAME,
    )

    // --- Set Build Settings ---
    const configurations = xcodeProject.pbxXCBuildConfigurationSection()
    for (const key in configurations) {
      // Ensure we are modifying the target's configurations
      if (
        typeof configurations[key].buildSettings !== "undefined" &&
        configurations[key].buildSettings.PRODUCT_NAME === `"${EXTENSION_NAME}"`
      ) {
        const buildSettings = configurations[key].buildSettings
        buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET
        buildSettings.INFOPLIST_FILE = `${EXTENSION_NAME}/${INFO_PLIST_FILENAME}`
        // buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleId}"` // Often set automatically, but can be explicit
        buildSettings.CODE_SIGN_STYLE = '"Automatic"' // Use Automatic signing
        // Set development team if needed, but usually handled by EAS/Xcode
        // buildSettings.DEVELOPMENT_TEAM = props?.devTeam;
      }
    }
    // --- End Set Build Settings ---

    return mod
  })
}
