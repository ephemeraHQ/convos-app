// import { ConfigPlugin, withXcodeProject } from "expo/config-plugins"
// import { DEPLOYMENT_TARGET, EXTENSION_NAME, INFO_PLIST_FILENAME, SWIFT_VERSION } from "./constants"
// import { findTargetByName } from "./xcode/get-target"

// /**
//  * Sets necessary build settings for the NSE target.
//  */
// export const withNSESettings: ConfigPlugin = (config) => {
//   return withXcodeProject(config, (projConfig) => {
//     const project = projConfig.modResults
//     const target = findTargetByName(project, EXTENSION_NAME)

//     if (!target) {
//       console.warn(`[withNSESettings] Target ${EXTENSION_NAME} not found. Skipping settings.`)
//       return projConfig
//     }

//     console.log(`[withNSESettings] Setting build settings for target ${target.name}...`)

//     const configurations = project.pbxXCBuildConfigurationSection()
//     for (const key in configurations) {
//       const buildConfig = configurations[key]
//       // Check if this config belongs to the NSE target
//       // Need to check against the Configuration List associated with the target UUID
//       const configList = project.pbxXCConfigurationList()
//       const targetConfigListKey =
//         project.pbxNativeTargetSection()[target.uuid]?.buildConfigurationList

//       if (
//         targetConfigListKey &&
//         configList[targetConfigListKey]?.buildConfigurations.some((bc: any) => bc.value === key)
//       ) {
//         console.log(`  - Modifying config: ${buildConfig.name} (${key})`)
//         const buildSettings = buildConfig.buildSettings

//         buildSettings["IPHONEOS_DEPLOYMENT_TARGET"] = DEPLOYMENT_TARGET
//         buildSettings["INFOPLIST_FILE"] = `"${EXTENSION_NAME}/${INFO_PLIST_FILENAME}"` // Ensure quotes
//         buildSettings["CODE_SIGN_STYLE"] = '"Automatic"'
//         buildSettings["PRODUCT_NAME"] = `"${EXTENSION_NAME}"`
//         buildSettings["SWIFT_VERSION"] = SWIFT_VERSION
//         // Set version variables using standard Xcode vars - relying on inheritance from host
//         buildSettings["CURRENT_PROJECT_VERSION"] = `"$(CURRENT_PROJECT_VERSION)"`
//         buildSettings["MARKETING_VERSION"] = `"$(MARKETING_VERSION)"`

//         // Add other necessary settings here if discovered later (e.g., search paths if Podfile inherit fails)
//       }
//     }

//     console.log(`[withNSESettings] Finished setting build settings.`)

//     projConfig.modResults = project
//     return projConfig
//   })
// }
