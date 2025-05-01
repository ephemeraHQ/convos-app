import fs from "fs"
import path from "path"
import { withXcodeProject, type ConfigPlugin } from "@expo/config-plugins"
import { findNativeTargetByName } from "@expo/config-plugins/build/ios/Target"
import { DEPLOYMENT_TARGET, EXTENSION_NAME, INFO_PLIST_FILENAME, PRODUCT_TYPE } from "./constants"

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

    // Create a PBX group for the extension sources
    const group = xcodeProject.addPbxGroup([], EXTENSION_NAME, EXTENSION_NAME)
    const mainGroupKey = xcodeProject.getFirstProject().firstProject.mainGroup
    xcodeProject.getPBXGroupByKey(mainGroupKey).children.push({
      value: group.uuid,
      comment: EXTENSION_NAME,
    })
    console.log(`[withNotificationExtensionTarget] Created PBXGroup '${EXTENSION_NAME}'`)

    // Add a new target for the Notification Service Extension
    const target = xcodeProject.addTarget(EXTENSION_NAME, PRODUCT_TYPE, EXTENSION_NAME, bundleId)
    console.log(
      `[withNotificationExtensionTarget] Added Target '${EXTENSION_NAME}' (UUID: ${target.uuid})`,
    )

    // --- Manually Add Files to Correct Build Phases ---

    // Get references to the build phase objects associated *with the new target*
    const buildPhaseObjects = xcodeProject.hash.project.objects["PBXSourcesBuildPhase"] || {}
    const resourcePhaseObjects = xcodeProject.hash.project.objects["PBXResourcesBuildPhase"] || {}

    let sourcesPhaseUUID: string | null = null
    let resourcesPhaseUUID: string | null = null

    const targetBuildPhaseRefs = target.buildPhases || []
    for (const phaseRef of targetBuildPhaseRefs) {
      if (buildPhaseObjects[phaseRef.value]) {
        sourcesPhaseUUID = phaseRef.value
        console.log(
          `[withNotificationExtensionTarget] Found Sources Phase UUID for NSE target: ${sourcesPhaseUUID}`,
        )
      } else if (resourcePhaseObjects[phaseRef.value]) {
        resourcesPhaseUUID = phaseRef.value
        console.log(
          `[withNotificationExtensionTarget] Found Resources Phase UUID for NSE target: ${resourcesPhaseUUID}`,
        )
      }
    }

    if (!sourcesPhaseUUID) {
      console.warn(
        `[withNotificationExtensionTarget] Could not find PBXSourcesBuildPhase for target ${EXTENSION_NAME}. Swift files won't be compiled.`,
      )
    }
    if (!resourcesPhaseUUID) {
      console.warn(
        `[withNotificationExtensionTarget] Could not find PBXResourcesBuildPhase for target ${EXTENSION_NAME}. Plist/Entitlements might not be copied.`,
      )
    }

    // Iterate through files copied by withNotificationExtensionFiles
    const filesDirPath = path.join(mod.modRequest.platformProjectRoot, EXTENSION_NAME)
    const files = fs.readdirSync(filesDirPath)

    console.log(
      `[withNotificationExtensionTarget] Adding files from ${filesDirPath} to target '${EXTENSION_NAME}' phases...`,
    )

    for (const fileName of files) {
      const fileRelativePath = path.join(EXTENSION_NAME, fileName) // Path relative to project root (e.g., "ConvosNSE/Info.plist")
      // Add file reference to the project, linked to the ConvosNSE group
      const fileRef = xcodeProject.addFile(fileRelativePath, group.uuid)

      if (!fileRef) {
        console.warn(
          `[withNotificationExtensionTarget] Failed to add file reference for ${fileRelativePath}. Skipping build phase addition.`,
        )
        continue
      }

      console.log(`  - Added file reference for: ${fileRelativePath} (UUID: ${fileRef.uuid})`)

      // Add to the correct build phase based on extension
      if (fileName.endsWith(".swift") && sourcesPhaseUUID) {
        // Add to Compile Sources phase of the NSE target
        xcodeProject.addFileToPbxBuildPhase(fileRef, sourcesPhaseUUID)
        console.log(`    - Added ${fileName} to PBXSourcesBuildPhase (${sourcesPhaseUUID})`)
      } else if (
        (fileName.endsWith(".plist") || fileName.endsWith(".entitlements")) &&
        resourcesPhaseUUID
      ) {
        // Add to Copy Bundle Resources phase of the NSE target
        xcodeProject.addFileToPbxBuildPhase(fileRef, resourcesPhaseUUID)
        console.log(`    - Added ${fileName} to PBXResourcesBuildPhase (${resourcesPhaseUUID})`)
      } else {
        console.log(
          `    - Skipped adding ${fileName} to build phases (unhandled extension or phase not found)`,
        )
      }
    }
    // --- End Manual File Addition ---

    // Remove the old explicit phase creation - it should be automatic or handled above
    // xcodeProject.addBuildPhase( [], "PBXResourcesBuildPhase", "Resources", target.uuid, EXTENSION_NAME );

    // --- Set Build Settings (Remains the same) ---
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
      }
    }
    // --- End Set Build Settings ---

    console.log(`[withNotificationExtensionTarget] Finished configuring target '${EXTENSION_NAME}'`)
    return mod
  })
}
