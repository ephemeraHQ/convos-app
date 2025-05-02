import fs from "fs"
import path from "path"
import { withXcodeProject, type ConfigPlugin } from "@expo/config-plugins"
import { findNativeTargetByName } from "@expo/config-plugins/build/ios/Target"
import {
  DEPLOYMENT_TARGET,
  EXTENSION_NAME,
  INFO_PLIST_FILENAME,
  PRODUCT_TYPE,
} from "./constants/constants"

export const withNotificationExtensionTarget: ConfigPlugin = (config) => {
  return withXcodeProject(config, (mod) => {
    const xcodeProject = mod.modResults

    // Skip if the target already exists
    try {
      findNativeTargetByName(xcodeProject, EXTENSION_NAME)
      console.log(
        `[withNotificationExtensionTarget] Target '${EXTENSION_NAME}' already exists. Skipping creation.`,
      )
      return mod
    } catch {}

    const bundleId = `${config.ios!.bundleIdentifier}.${EXTENSION_NAME.toLowerCase()}`

    // --- Get file paths relative to the group ---
    const filesDirPath = path.join(mod.modRequest.platformProjectRoot, EXTENSION_NAME)
    const files = fs.readdirSync(filesDirPath)
    const sourceFiles = files.filter((f) => f.endsWith(".swift")) // e.g., ["NotificationService.swift"]
    // --- CORRECTED resourceFiles ---
    // Only include files that NEED to be copied, EXCLUDE the main Info.plist
    const resourceFiles = files.filter(
      (f) =>
        (f.endsWith(".plist") && f !== INFO_PLIST_FILENAME) || // Keep other plists (if any)
        f.endsWith(".entitlements") || // Keep entitlements
        // Add other resource types here if needed (e.g., .json, images)
        (!f.endsWith(".swift") && !f.endsWith(".plist") && !f.endsWith(".entitlements")), // Catch-all for other potential resources
    )
    // Filter out the main Info.plist specifically if caught by the catch-all
    const finalResourceFiles = resourceFiles.filter((f) => f !== INFO_PLIST_FILENAME)
    // --- END CORRECTION ---
    const allFilePathsForGroup = files // All files to be shown in the group visually

    console.log(
      `[withNotificationExtensionTarget] Found files: Sources=[${sourceFiles.join(", ")}], Resources=[${finalResourceFiles.join(", ")}] (Info.plist excluded)`,
    )
    // --- End Get Files ---

    // --- Create Group and Add Files Visually ---
    // Create new PBXGroup for the extension, containing references to be shown in Xcode navigator
    const group = xcodeProject.addPbxGroup(
      allFilePathsForGroup, // Files to show in the folder
      EXTENSION_NAME, // Name of the folder
      EXTENSION_NAME, // Path of the folder relative to project root
    )
    console.log(
      `[withNotificationExtensionTarget] Created PBXGroup '${EXTENSION_NAME}' (UUID: ${group.uuid}) linked to files.`,
    )

    // Add the new PBXGroup to the top level group.
    const mainGroupKey = xcodeProject.getFirstProject().firstProject.mainGroup
    xcodeProject.addToPbxGroup(group.uuid, mainGroupKey)
    console.log(
      `[withNotificationExtensionTarget] Added PBXGroup ${group.uuid} to MainGroup ${mainGroupKey}`,
    )
    // --- End Group Creation ---

    // --- Add Target ---
    // This function should ideally handle basic setup like build configurations
    const target = xcodeProject.addTarget(
      EXTENSION_NAME,
      PRODUCT_TYPE,
      EXTENSION_NAME, // Product Name should match target name
      bundleId,
    )
    console.log(
      `[withNotificationExtensionTarget] Added Target '${EXTENSION_NAME}' (UUID: ${target.uuid})`,
    )
    // --- End Add Target ---

    // --- Add Build Phases with Files ---
    // Add PBXSourcesBuildPhase containing the source files
    xcodeProject.addBuildPhase(
      sourceFiles, // Pass the array of source filenames
      "PBXSourcesBuildPhase",
      "Sources", // Standard name for the phase
      target.uuid,
    )
    console.log(
      `[withNotificationExtensionTarget] Added Sources Build Phase for target ${target.uuid} with files: ${sourceFiles.join(", ")}`,
    )

    // Use the filtered list for Resources phase
    xcodeProject.addBuildPhase(
      finalResourceFiles, // <--- Use the filtered list
      "PBXResourcesBuildPhase",
      "Resources",
      target.uuid,
    )
    console.log(
      `[withNotificationExtensionTarget] Added Resources Build Phase for target ${target.uuid} with files: ${finalResourceFiles.join(", ")}`,
    )

    // Optionally add PBXFrameworksBuildPhase if needed, though often implicit
    xcodeProject.addBuildPhase(
      [], // No frameworks explicitly added here, system ones linked automatically
      "PBXFrameworksBuildPhase",
      "Frameworks",
      target.uuid,
    )
    console.log(
      `[withNotificationExtensionTarget] Added Frameworks Build Phase for target ${target.uuid}`,
    )
    // --- End Add Build Phases ---

    // --- Set Build Settings ---
    // This loop correctly targets the configurations associated with the NSE target
    const configurations = xcodeProject.pbxXCBuildConfigurationSection()
    for (const key in configurations) {
      if (
        typeof configurations[key].buildSettings !== "undefined" &&
        configurations[key].buildSettings.PRODUCT_NAME === `"${EXTENSION_NAME}"`
      ) {
        console.log(`[withNotificationExtensionTarget] Setting build configurations for ${key}`)
        const buildSettings = configurations[key].buildSettings
        buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET
        buildSettings.INFOPLIST_FILE = `${EXTENSION_NAME}/${INFO_PLIST_FILENAME}`
        buildSettings.CODE_SIGN_STYLE = '"Automatic"'
        buildSettings.PRODUCT_NAME = `"${EXTENSION_NAME}"`
        buildSettings.SWIFT_VERSION = "5.0"
      }
    }
    // --- End Set Build Settings ---

    console.log(`[withNotificationExtensionTarget] Finished configuring target '${EXTENSION_NAME}'`)
    return mod
  })
}
