import assert from "assert"
import fs from "fs"
import path from "path"
import { ConfigPlugin, withXcodeProject } from "expo/config-plugins"
import {
  DEPLOYMENT_TARGET,
  EXTENSION_NAME,
  INFO_PLIST_FILENAME,
  PRODUCT_TYPE,
  SWIFT_VERSION,
} from "./constants"
import { addTargetDependency } from "./xcode/add-target-dependency"

/**
 * Configures the Xcode project for the NSE within a single mod,
 * using direct xcode.js calls for project structure.
 */
export const withNSEXcodeProject: ConfigPlugin = (config) => {
  const hostAppName = config.name?.replace(/\s/g, "")
  assert(hostAppName, "Could not determine host app name from config.name")

  return withXcodeProject(config, (projConfig) => {
    const project = projConfig.modResults
    console.log("[withNSEXcodeProject] Running consolidated Xcode modifications...")

    // --- 1. Create Target ---
    const bundleId = `${config.ios!.bundleIdentifier}.${EXTENSION_NAME.toLowerCase()}`
    const productName = EXTENSION_NAME
    // Use the raw addTarget function from xcode.js library
    const newTarget = project.addTarget(EXTENSION_NAME, PRODUCT_TYPE, productName, bundleId)
    if (!newTarget?.uuid) {
      throw new Error(`Failed to create target ${EXTENSION_NAME}`)
    }
    const newTargetUuid = newTarget.uuid
    console.log(`[withNSEXcodeProject] Created Target ${EXTENSION_NAME} (UUID: ${newTargetUuid})`)

    // --- 2. Add Build Phases (Using direct xcode.js calls) ---
    console.log(`  - Adding Build Phases for ${EXTENSION_NAME}...`)
    const sourceFilePaths = [] // We'll add files later
    const resourceFilePaths = [] // We'll add files later
    const sourcesPhase = project.addBuildPhase(
      sourceFilePaths,
      "PBXSourcesBuildPhase",
      "Sources",
      newTargetUuid,
    )
    const resourcesPhase = project.addBuildPhase(
      resourceFilePaths,
      "PBXResourcesBuildPhase",
      "Resources",
      newTargetUuid,
    )
    const frameworksPhase = project.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      newTargetUuid,
    )

    console.log(
      `  - Added Build Phases: Sources=${sourcesPhase.uuid}, Resources=${resourcesPhase.uuid}, Frameworks=${frameworksPhase.uuid}`,
    )
    // --- End Build Phases ---

    // --- 3. Create Group & Link Files ---
    console.log(`  - Creating PBXGroup and linking files for ${EXTENSION_NAME}...`)
    const filesDirPath = path.join(projConfig.modRequest.platformProjectRoot, EXTENSION_NAME)
    if (!fs.existsSync(filesDirPath)) {
      throw new Error(`Cannot find source directory ${filesDirPath}.`)
    }
    const files = fs.readdirSync(filesDirPath)
    const group = project.addPbxGroup([], EXTENSION_NAME, EXTENSION_NAME) // Create empty group
    project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup) // Add group to project

    const fileGroup = project.getPBXGroupByKey(group.uuid) // Get group object
    if (!fileGroup) {
      throw new Error(`Failed to retrieve PBXGroup ${group.uuid}`)
    }

    fileGroup.children = fileGroup.children || [] // Ensure children array
    for (const fileName of files) {
      const fileRelativePath = path.join(EXTENSION_NAME, fileName)
      const fileRef = project.addFile(fileRelativePath) // Create file ref
      if (!fileRef?.uuid) {
        console.warn(`    - Failed to create file reference for ${fileRelativePath}.`)
        continue
      }
      // Add ref to visual group
      if (!fileGroup.children.some((child: any) => child && child.value === fileRef.uuid)) {
        fileGroup.children.push({ value: fileRef.uuid, comment: fileName })
      }
      // Add ref to appropriate build phase
      if (fileName.endsWith(".swift")) {
        project.addFileToPbxBuildPhase(fileRef, sourcesPhase.uuid)
      } else if (fileName.endsWith(".entitlements")) {
        // Only add entitlements to resources
        project.addFileToPbxBuildPhase(fileRef, resourcesPhase.uuid)
      }
    }
    console.log(`[withNSEXcodeProject] Created group and linked files to phases.`)
    // --- End Group & Files ---

    // --- 4. Set Build Settings ---
    console.log(`  - Setting Build Settings for ${EXTENSION_NAME}...`)
    const configurations = project.pbxXCBuildConfigurationSection()
    // Find the config list UUID associated with the new target
    const configListUuid = project.pbxNativeTargetSection()[newTargetUuid]?.buildConfigurationList
    const configList = project.pbxXCConfigurationList()[configListUuid]
    if (!configList) {
      throw new Error(`Could not find config list for new target ${newTargetUuid}`)
    }

    for (const configRef of configList.buildConfigurations) {
      const buildConfig = configurations[configRef.value]
      if (buildConfig) {
        const buildSettings = buildConfig.buildSettings || {}
        buildSettings["IPHONEOS_DEPLOYMENT_TARGET"] = DEPLOYMENT_TARGET
        buildSettings["INFOPLIST_FILE"] = `"${EXTENSION_NAME}/${INFO_PLIST_FILENAME}"`
        buildSettings["CODE_SIGN_STYLE"] = '"Automatic"'
        buildSettings["PRODUCT_NAME"] = `"${EXTENSION_NAME}"`
        buildSettings["SWIFT_VERSION"] = SWIFT_VERSION
        buildSettings["CURRENT_PROJECT_VERSION"] = `"$(CURRENT_PROJECT_VERSION)"`
        buildSettings["MARKETING_VERSION"] = `"$(MARKETING_VERSION)"`
        buildConfig.buildSettings = buildSettings
      }
    }
    console.log(`[withNSEXcodeProject] Set Build Settings.`)
    // --- End Build Settings ---

    // --- 5. Add Host Dependency ---
    console.log(`  - Adding host dependency for ${EXTENSION_NAME}...`)
    // Use the specific helper we confirmed works
    addTargetDependency(project, { uuid: newTargetUuid })
    console.log(`[withNSEXcodeProject] Called addTargetDependency helper.`)
    // --- End Dependency ---

    console.log(`[withNSEXcodeProject] Finished all configuration for target '${EXTENSION_NAME}'`)

    projConfig.modResults = project
    return projConfig
  })
}
