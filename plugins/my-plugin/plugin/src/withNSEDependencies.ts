// import assert from "assert"
// import { ConfigPlugin, withXcodeProject } from "expo/config-plugins"
// import { EXTENSION_NAME } from "./constants"
// import { addTargetDependency } from "./xcode/add-target-dependency" // Import the helper
// import { findTargetByName } from "./xcode/get-target"

// /**
//  * Adds the host app target as a dependency for the NSE target.
//  */
// export const withNSEDependencies: ConfigPlugin = (config) => {
//   // Get the host app's target name (without spaces)
//   const hostAppName = config.name?.replace(/\s/g, "")
//   assert(hostAppName, "[withNSEDependencies] Could not determine host app name from config.name")

//   return withXcodeProject(config, (projConfig) => {
//     const project = projConfig.modResults
//     const nseTarget = findTargetByName(project, EXTENSION_NAME)
//     const hostTarget = findTargetByName(project, hostAppName)

//     if (!nseTarget) {
//       console.warn(
//         `[withNSEDependencies] NSE target ${EXTENSION_NAME} not found. Skipping dependency.`,
//       )
//       return projConfig
//     }
//     if (!hostTarget) {
//       console.warn(
//         `[withNSEDependencies] Host target ${hostAppName} not found. Skipping dependency.`,
//       )
//       return projConfig
//     }

//     console.log(
//       `[withNSEDependencies] Adding host ${hostTarget.name} as dependency for ${nseTarget.name}...`,
//     )

//     // Use the helper function
//     addTargetDependency(project, {
//       uuid: nseTarget.uuid,
//     })

//     console.log(`[withNSEDependencies] Dependency potentially added.`)

//     projConfig.modResults = project
//     return projConfig
//   })
// }
