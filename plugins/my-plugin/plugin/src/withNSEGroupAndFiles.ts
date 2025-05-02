// import fs from "fs"
// import path from "path"
// import { ConfigPlugin, withXcodeProject } from "expo/config-plugins"
// import { EXTENSION_NAME } from "./constants"
// import { addPbxGroup } from "./xcode/add-pbx-group" // Import group helper
// import { findTargetByName } from "./xcode/get-target"

// // Assume addBuildPhases returns phase UUIDs or we can look them up again if needed

// /**
//  * Creates the NSE group in Xcode and adds file references, linking them to build phases.
//  */
// export const withNSEGroupAndFiles: ConfigPlugin = (config) => {
//   return withXcodeProject(config, (projConfig) => {
//     const project = projConfig.modResults
//     const target = findTargetByName(project, EXTENSION_NAME)

//     if (!target) {
//       console.warn(
//         `[withNSEGroupAndFiles] Target ${EXTENSION_NAME} not found. Skipping group/file addition.`,
//       )
//       return projConfig
//     }

//     // --- Get Build Phase UUIDs (Needed for linking files) ---
//     // We might need to re-query the target object to get phase UUIDs if not passed down
//     // For simplicity, assume we can requery or helpers handle it implicitly
//     const nseTargetObject = project.pbxNativeTargetSection()[target.uuid]
//     const sourcesPhaseRef = nseTargetObject.buildPhases.find(
//       (bp: any) =>
//         project.getPBXObjectClass(project.hash.project.objects[bp.value]) ===
//         "PBXSourcesBuildPhase",
//     )
//     const resourcesPhaseRef = nseTargetObject.buildPhases.find(
//       (bp: any) =>
//         project.getPBXObjectClass(project.hash.project.objects[bp.value]) ===
//         "PBXResourcesBuildPhase",
//     )

//     if (!sourcesPhaseRef?.value || !resourcesPhaseRef?.value) {
//       console.error(
//         `[withNSEGroupAndFiles] Could not find Sources or Resources phase UUIDs for target ${target.name}. Cannot link files.`,
//       )
//       return projConfig
//     }
//     const sourcesPhaseUuid = sourcesPhaseRef.value
//     const resourcesPhaseUuid = resourcesPhaseRef.value
//     console.log(
//       `[withNSEGroupAndFiles] Found phase UUIDs: Sources=${sourcesPhaseUuid}, Resources=${resourcesPhaseUuid}`,
//     )
//     // --- End Get Phases ---

//     // --- Get Files ---
//     const filesDirPath = path.join(projConfig.modRequest.platformProjectRoot, EXTENSION_NAME)
//     const files = fs.readdirSync(filesDirPath)
//     // Exclude Info.plist from files added to Resources phase, keep for group view
//     const filesForGroup = files.map((f) => path.join(EXTENSION_NAME, f))
//     const filesForSourcesPhase = files
//       .filter((f) => f.endsWith(".swift"))
//       .map((f) => path.join(EXTENSION_NAME, f))
//     const filesForResourcesPhase = files
//       .filter((f) => f.endsWith(".entitlements"))
//       .map((f) => path.join(EXTENSION_NAME, f))
//     // --- End Get Files ---

//     console.log(`[withNSEGroupAndFiles] Adding group '${EXTENSION_NAME}' and linking files...`)

//     // Create the visual group and add file references using the helper
//     // Pass paths relative to project root (ios/)
//     addPbxGroup(project, {
//       targetName: EXTENSION_NAME,
//       platformProjectRoot: projConfig.modRequest.platformProjectRoot,
//       fonts: [],
//       googleServicesFilePath: undefined,
//       preprocessingFilePath: undefined,
//     })

//     console.log(`[withNSEGroupAndFiles] Added group and linked files.`)

//     projConfig.modResults = project
//     return projConfig
//   })
// }
