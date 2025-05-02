// import { ConfigPlugin, withXcodeProject } from "expo/config-plugins"
// import { EXTENSION_NAME } from "./constants"
// import { addBuildPhases } from "./xcode/add-build-phases" // Import the specific helper
// import { findTargetByName } from "./xcode/get-target"

// /**
//  * Adds standard build phases (Sources, Resources, Frameworks) to the NSE target.
//  */
// export const withNSEBuildPhases: ConfigPlugin = (config) => {
//   return withXcodeProject(config, (projConfig) => {
//     const project = projConfig.modResults
//     const target = findTargetByName(project, EXTENSION_NAME)

//     if (!target) {
//       console.warn(
//         `[withNSEBuildPhases] Target ${EXTENSION_NAME} not found. Skipping phase addition.`,
//       )
//       return projConfig
//     }

//     console.log(
//       `[withNSEBuildPhases] Adding build phases to target ${target.name} (UUID: ${target.uuid})...`,
//     )

//     // Use the helper to add all standard phases at once
//     addBuildPhases(project, {
//       targetUuid: target.uuid,
//       groupName: "Copy Files",
//       productFile: {
//         uuid: target.uuid,
//         target: target.name,
//         basename: target.name,
//         group: "Copy Files",
//       },
//       resources: [],
//     })

//     projConfig.modResults = project
//     return projConfig
//   })
// }
