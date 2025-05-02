// import assert from "assert"
// import fs from "fs"
// import path from "path"
// import { withXcodeProject, type ConfigPlugin } from "@expo/config-plugins"
// import { findNativeTargetByName } from "@expo/config-plugins/build/ios/Target"
// import { DEPLOYMENT_TARGET, EXTENSION_NAME, INFO_PLIST_FILENAME, PRODUCT_TYPE } from "./constants"

// export const withNotificationExtensionTarget: ConfigPlugin = (config) => {
//   // Get the host app's target name (without spaces)
//   const hostAppName = config.name?.replace(/\s/g, "")
//   assert(hostAppName, "Could not determine host app name from config.name")

//   return withXcodeProject(config, (mod) => {
//     const xcodeProject = mod.modResults
//     const project = xcodeProject.getFirstProject().firstProject
//     let target: any
//     let nseTargetUuid: string | null = null
//     let hostTargetUuid: string | null = null
//     let hostTargetProxyUuid: string | null = null

//     // --- Find Host Target UUID and Proxy ---
//     const targets = project.targets || []
//     console.log("[withNotificationExtensionTarget] Finding Host Target UUID and Proxy...")
//     for (const targetRef of targets) {
//       const currentTargetName = targetRef.comment || ""
//       if (currentTargetName.replace(/\s/g, "") === hostAppName) {
//         hostTargetUuid = targetRef.value
//         // Create/Find the ContainerItemProxy for the host target
//         hostTargetProxyUuid = createOrGetTargetProxy(
//           xcodeProject,
//           hostTargetUuid,
//           currentTargetName,
//         )
//         console.log(
//           `  -> Found Host Target: Name='${currentTargetName}', UUID=${hostTargetUuid}, ProxyUUID=${hostTargetProxyUuid}`,
//         )
//         break
//       }
//     }
//     if (!hostTargetUuid || !hostTargetProxyUuid) {
//       console.warn(
//         `[withNotificationExtensionTarget] Could not find host target or create proxy for '${hostAppName}'. Dependency linking will fail.`,
//       )
//       // Optional: throw error if dependency is absolutely critical
//     }
//     // --- End Find Host ---

//     // Check if NSE target already exists
//     try {
//       target = findNativeTargetByName(xcodeProject, EXTENSION_NAME)
//       nseTargetUuid = target.uuid // Get UUID if found
//       console.log(
//         `[withNotificationExtensionTarget] Target '${EXTENSION_NAME}' already exists (UUID: ${nseTargetUuid}). Ensuring dependency.`,
//       )
//       // Ensure dependency link exists even if target was already there
//       if (hostTargetProxyUuid && nseTargetUuid) {
//         addTargetDependencyManually(xcodeProject, nseTargetUuid, hostTargetProxyUuid, hostAppName)
//       }
//       return mod
//     } catch {
//       console.log(
//         `[withNotificationExtensionTarget] Target '${EXTENSION_NAME}' not found. Creating...`,
//       )
//     }

//     // --- Create Group and Add Files Visually ---
//     // Create new PBXGroup for the extension, containing references to be shown in Xcode navigator
//     const group = xcodeProject.addPbxGroup([], EXTENSION_NAME, EXTENSION_NAME)
//     xcodeProject.addToPbxGroup(group.uuid, project.mainGroup)
//     console.log(`[withNotificationExtensionTarget] Created PBXGroup '${EXTENSION_NAME}'`)

//     // --- Add Target ---
//     // This function should ideally handle basic setup like build configurations
//     const bundleId = `${config.ios!.bundleIdentifier}.${EXTENSION_NAME.toLowerCase()}`
//     target = xcodeProject.addTarget(EXTENSION_NAME, PRODUCT_TYPE, EXTENSION_NAME, bundleId)
//     nseTargetUuid = target?.uuid
//     console.log(
//       `[withNotificationExtensionTarget] Added Target '${EXTENSION_NAME}' (UUID: ${nseTargetUuid ?? "UNKNOWN"})`,
//     )
//     if (!nseTargetUuid) {
//       console.error(
//         "[withNotificationExtensionTarget] Failed to get valid target object after addTarget.",
//       )
//       return mod
//     }

//     // --- Add Host App as Target Dependency MANUALLY ---
//     if (hostTargetProxyUuid) {
//       // Only proceed if host proxy was found/created
//       addTargetDependencyManually(xcodeProject, nseTargetUuid, hostTargetProxyUuid, hostAppName)
//     } else {
//       console.warn(
//         `[withNotificationExtensionTarget] Cannot add host dependency because host target proxy was not found/created.`,
//       )
//     }
//     // --- End Add Dependency ---

//     // --- Add Build Phases with Files ---
//     // Add PBXSourcesBuildPhase containing the source files
//     const filesDirPath = path.join(mod.modRequest.platformProjectRoot, EXTENSION_NAME)
//     const files = fs.readdirSync(filesDirPath)
//     const sourceFiles = files.filter((f) => f.endsWith(".swift")) // e.g., ["NotificationService.swift"]
//     // --- CORRECTED resourceFiles ---
//     // Only include files that NEED to be copied, EXCLUDE the main Info.plist
//     const resourceFiles = files.filter(
//       (f) =>
//         (f.endsWith(".plist") && f !== INFO_PLIST_FILENAME) || // Keep other plists (if any)
//         f.endsWith(".entitlements") || // Keep entitlements
//         // Add other resource types here if needed (e.g., .json, images)
//         (!f.endsWith(".swift") && !f.endsWith(".plist") && !f.endsWith(".entitlements")), // Catch-all for other potential resources
//     )
//     // Filter out the main Info.plist specifically if caught by the catch-all
//     const finalResourceFiles = resourceFiles.filter((f) => f !== INFO_PLIST_FILENAME)
//     // --- END CORRECTION ---
//     const allFilePathsForGroup = files // All files to be shown in the group visually

//     // --- Add Build Phases (ensure this section adds empty phases correctly) ---
//     const sourcesPhase = xcodeProject.addBuildPhase(
//       sourceFiles,
//       "PBXSourcesBuildPhase",
//       "Sources",
//       target.uuid,
//     )
//     const resourcesPhase = xcodeProject.addBuildPhase(
//       finalResourceFiles,
//       "PBXResourcesBuildPhase",
//       "Resources",
//       target.uuid,
//     )
//     const frameworksPhase = xcodeProject.addBuildPhase(
//       [],
//       "PBXFrameworksBuildPhase",
//       "Frameworks",
//       target.uuid,
//     )

//     // Verify phases were created (add checks if needed, though addBuildPhase usually throws on error)
//     if (!sourcesPhase?.uuid || !resourcesPhase?.uuid || !frameworksPhase?.uuid) {
//       console.error(
//         "[withNotificationExtensionTarget] Failed to create one or more essential build phases. Aborting file linking.",
//       )
//       return mod // Cannot proceed if phases are missing
//     }
//     const sourcesPhaseUUID = sourcesPhase.uuid
//     const resourcesPhaseUUID = resourcesPhase.uuid
//     console.log(
//       `[withNotificationExtensionTarget] Ensured Build Phases exist: Sources=${sourcesPhaseUUID}, Resources=${resourcesPhaseUUID}, Frameworks=${frameworksPhase.uuid}`,
//     )
//     // --- End Add Build Phases ---

//     // --- Link Files to Group and Correct Build Phases ---
//     const filesToLink = fs.readdirSync(filesDirPath)
//     console.log(
//       `[withNotificationExtensionTarget] Linking files from ${filesDirPath} to target '${EXTENSION_NAME}' group and phases...`,
//     )

//     // Get the group object once before the loop
//     const fileGroup = xcodeProject.getPBXGroupByKey(group.uuid)
//     if (!fileGroup) {
//       console.error(
//         `[withNotificationExtensionTarget] CRITICAL: Could not find PBXGroup object for UUID ${group.uuid}. Cannot link files to group.`,
//       )
//       // Depending on severity, might want to return mod or throw
//     } else {
//       console.log(`[withNotificationExtensionTarget] Found PBXGroup object for ${EXTENSION_NAME}`)
//       fileGroup.children = fileGroup.children || [] // Ensure children array exists
//     }

//     for (const fileName of filesToLink) {
//       const fileRelativePath = path.join(EXTENSION_NAME, fileName)
//       console.log(`[LinkFiles] ===== Processing file: ${fileName} =====`)

//       // 1. Create the file reference using only the path
//       let fileRef: any = null
//       try {
//         fileRef = xcodeProject.addFile(fileRelativePath) // NO group UUID here
//         console.log(
//           `[LinkFiles] addFile result: Type=${typeof fileRef}, Value=${fileRef === null ? "null" : JSON.stringify(fileRef)}`,
//         )
//       } catch (e) {
//         console.error(`[LinkFiles] Error calling addFile for ${fileRelativePath}:`, e)
//         continue
//       }

//       // 2. Check if the reference is valid
//       if (!fileRef?.uuid) {
//         console.warn(
//           `[LinkFiles] Failed to create valid file reference for ${fileRelativePath}. Skipping group/phase addition.`,
//         )
//         continue
//       }
//       console.log(`[LinkFiles] Created valid file reference UUID: ${fileRef.uuid}`)

//       // 3. Manually add the reference to the group's children array
//       if (fileGroup && Array.isArray(fileGroup.children)) {
//         // Check if not already present
//         if (!fileGroup.children.some((child: any) => child && child.value === fileRef.uuid)) {
//           fileGroup.children.push({ value: fileRef.uuid, comment: fileName })
//           console.log(`[LinkFiles] Manually added FileRef ${fileRef.uuid} to Group ${group.uuid}`)
//         } else {
//           console.log(`[LinkFiles] FileRef ${fileRef.uuid} already in Group ${group.uuid}`)
//         }
//       } else {
//         console.warn(
//           `[LinkFiles] Cannot add FileRef ${fileRef.uuid} to Group ${group.uuid} (Group object invalid or children not array)`,
//         )
//       }

//       // 4. Add the valid file reference to the correct build phase
//       let targetPhaseUUID: string | null = null
//       if (fileName.endsWith(".swift")) {
//         targetPhaseUUID = sourcesPhaseUUID
//       } else if (finalResourceFiles.includes(fileName)) {
//         targetPhaseUUID = resourcesPhaseUUID
//       } // Use the filtered list

//       if (targetPhaseUUID) {
//         try {
//           xcodeProject.addFileToPbxBuildPhase(fileRef, targetPhaseUUID)
//           console.log(
//             `[LinkFiles] Added ${fileName} (Ref: ${fileRef.uuid}) to Phase ${targetPhaseUUID}`,
//           )
//         } catch (e) {
//           console.error(
//             `[LinkFiles] FAILED to add ${fileName} (Ref: ${fileRef.uuid}) to Phase ${targetPhaseUUID}:`,
//             e,
//           )
//         }
//       } else {
//         console.log(
//           `[LinkFiles] Skipped adding ${fileName} to build phases (unhandled type or target phase not found).`,
//         )
//       }
//       console.log(`[LinkFiles] ===== Finished file: ${fileName} =====`)
//     }
//     // --- End Linking ---

//     // --- Set Build Settings ---
//     // This loop correctly targets the configurations associated with the NSE target
//     const configurations = xcodeProject.pbxXCBuildConfigurationSection()
//     for (const key in configurations) {
//       if (
//         configurations[key].isa === "XCBuildConfiguration" && // Ensure it's a build config obj
//         configurations[key].buildSettings?.PRODUCT_NAME === `"${EXTENSION_NAME}"` // Use optional chaining
//       ) {
//         console.log(`[withNotificationExtensionTarget] Setting build configurations for ${key}`)
//         const buildSettings = configurations[key].buildSettings
//         buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET
//         buildSettings.INFOPLIST_FILE = `${EXTENSION_NAME}/${INFO_PLIST_FILENAME}`
//         buildSettings.CODE_SIGN_STYLE = '"Automatic"'
//         buildSettings.PRODUCT_NAME = `"${EXTENSION_NAME}"`
//         buildSettings.SWIFT_VERSION = "5.0"
//       }
//     }
//     // --- End Set Build Settings ---

//     console.log(`[withNotificationExtensionTarget] Finished configuring target '${EXTENSION_NAME}'`)
//     return mod
//   })
// }

// // Helper to find/create PBXContainerItemProxy needed for target dependency
// function createOrGetTargetProxy(
//   project: any,
//   targetUuid: string,
//   targetName: string,
// ): string | null {
//   const proxySection = project.hash.project.objects["PBXContainerItemProxy"] || {}
//   // Check if a proxy already exists for this target
//   for (const key in proxySection) {
//     if (
//       proxySection[key].containerPortal === project.hash.project.rootObject &&
//       proxySection[key].remoteGlobalIDString === targetUuid
//     ) {
//       console.log(`  - Found existing Proxy for ${targetName}: ${key}`)
//       return key // Return existing proxy UUID
//     }
//   }

//   // Create new proxy if not found
//   const proxyUuid = project.generateUuid()
//   const proxyComment = targetName // Use target name for comment
//   console.log(`  - Creating new Proxy for ${targetName}: ${proxyUuid}`)
//   project.hash.project.objects["PBXContainerItemProxy"] =
//     project.hash.project.objects["PBXContainerItemProxy"] || {}
//   project.hash.project.objects["PBXContainerItemProxy"][proxyUuid] = {
//     // Use generated UUID
//     isa: "PBXContainerItemProxy",
//     containerPortal: project.hash.project.rootObject, // PBXProject UUID
//     containerPortal_comment: project.hash.project.rootObject_comment,
//     proxyType: "1", // Target proxy type
//     remoteGlobalIDString: targetUuid,
//     remoteInfo: targetName,
//   }
//   // Add comment to the section entry itself
//   project.hash.project.objects["PBXContainerItemProxy"][`${proxyUuid}_comment`] = proxyComment
//   return proxyUuid
// }

// // Helper function to MANUALLY add the host app as a dependency for the extension target
// function addTargetDependencyManually(
//   project: any,
//   extensionTargetUuid: string,
//   hostTargetProxyUuid: string,
//   hostTargetName: string,
// ) {
//   console.log(
//     `[addTargetDependencyManually] Linking Ext:${extensionTargetUuid} to HostProxy:${hostTargetProxyUuid}`,
//   )

//   // 1. Create the PBXTargetDependency object
//   const dependencyUuid = project.generateUuid()
//   const dependencyComment = hostTargetName
//   project.hash.project.objects["PBXTargetDependency"] =
//     project.hash.project.objects["PBXTargetDependency"] || {}
//   project.hash.project.objects["PBXTargetDependency"][dependencyUuid] = {
//     // Use generated UUID
//     isa: "PBXTargetDependency",
//     name: `"${hostTargetName}"`,
//     targetProxy: hostTargetProxyUuid,
//     targetProxy_comment: hostTargetName,
//   }
//   // Add comment to the section entry itself
//   project.hash.project.objects["PBXTargetDependency"][`${dependencyUuid}_comment`] =
//     dependencyComment
//   console.log(`  - Created PBXTargetDependency: ${dependencyUuid}`)

//   // 2. Add the dependency to the extension target's dependencies list
//   const extensionTargetObject = project.pbxNativeTargetSection()[extensionTargetUuid]
//   if (!extensionTargetObject) {
//     console.warn(
//       `[addTargetDependencyManually] Could not find extension target object for UUID: ${extensionTargetUuid}`,
//     )
//     return
//   }
//   extensionTargetObject.dependencies = extensionTargetObject.dependencies || []
//   // Ensure it's not already added
//   if (!extensionTargetObject.dependencies.some((dep: any) => dep.value === dependencyUuid)) {
//     // Add UUID and comment separately
//     extensionTargetObject.dependencies.push({ value: dependencyUuid, comment: dependencyComment })
//     console.log(`  - Added dependency ${dependencyUuid} to extension target ${extensionTargetUuid}`)
//   } else {
//     console.log(
//       `  - Dependency ${dependencyUuid} already present on extension target ${extensionTargetUuid}`,
//     )
//   }
// }
