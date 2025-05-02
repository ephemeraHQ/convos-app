// import fs from "fs"
// import path from "path"
// import { ConfigPlugin, withDangerousMod } from "@expo/config-plugins"
// import { EXTENSION_NAME } from "./constants"

// /**
//  * Modifies the Podfile to add the NSE target NESTED within the main app target,
//  * allowing it to inherit dependencies via search paths.
//  * This is required by Cocoapods to resolve the host-target relationship.
//  */
// export const withNSEPodfileTarget: ConfigPlugin = (config) => {
//   return withDangerousMod(config, [
//     "ios",
//     async (modConfig) => {
//       const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile")
//       let podfileContent = fs.readFileSync(podfilePath, "utf-8")

//       // Idempotency check: Do nothing if target already exists
//       const targetMarker = `target '${EXTENSION_NAME}' do`
//       if (podfileContent.includes(targetMarker)) {
//         return modConfig
//       }

//       // Find the main application target line (e.g., "target 'YourAppName' do")
//       const appName = config.name?.replace(/\s/g, "") ?? ""
//       assert(
//         appName,
//         "[withNSEPodfileTarget] Could not determine main app target name from config.name.",
//       )
//       const mainTargetMarker = `target '${appName}' do`
//       const mainTargetLineIndex = podfileContent.indexOf(mainTargetMarker)

//       if (mainTargetLineIndex === -1) {
//         // Check for quoted name as a fallback, though less common for target names
//         const appNameQuoted = `"${appName}"`
//         const mainTargetMarkerQuoted = `target ${appNameQuoted} do`
//         const mainTargetLineIndexQuoted = podfileContent.indexOf(mainTargetMarkerQuoted)
//         if (mainTargetLineIndexQuoted === -1) {
//           throw new Error(
//             `[withNSEPodfileTarget] Could not find main target marker "${mainTargetMarker}" or "${mainTargetMarkerQuoted}" in Podfile.`,
//           )
//         }
//         console.warn(
//           `[withNSEPodfileTarget] Found main target marker with quotes. Ensure this is correct.`,
//         )
//         // If found with quotes, adjust logic if needed, otherwise error was thrown
//       }

//       // Find the end of that line (the newline character) to insert after
//       const endOfMainTargetLine = podfileContent.indexOf("\n", mainTargetLineIndex)
//       if (endOfMainTargetLine === -1) {
//         throw new Error(
//           `[withNSEPodfileTarget] Could not find newline after main target marker in Podfile.`,
//         )
//       }

//       // Generate the nested NSE target block content
//       const nseTargetBlock = generateNestedNseTargetBlock()

//       // Insert the block immediately after the main target line's newline
//       podfileContent =
//         podfileContent.slice(0, endOfMainTargetLine + 1) + // Include the newline
//         nseTargetBlock +
//         podfileContent.slice(endOfMainTargetLine + 1)

//       console.log(
//         `[withNSEPodfileTarget] Inserted NESTED NSE target block within '${appName}' target in Podfile.`,
//       )
//       fs.writeFileSync(podfilePath, podfileContent)
//       return modConfig
//     },
//   ])
// }

// // Generates the NESTED Podfile target block content using inherit!
// function generateNestedNseTargetBlock(): string {
//   const podLines = [
//     "    # Inherit search paths from host target to find linked pods like XMTP",
//     "    inherit! :search_paths", // Indent level 2
//     "    # Add any NSE-specific pods here if needed (e.g., pod 'MMKVAppExtension')",
//   ].join("\n")

//   // Indentation level 1 for the target block itself, nested inside main target
//   return `
//   target '${EXTENSION_NAME}' do
// ${podLines}
//   end
// `
// }

// // Helper assertion function
// function assert(value: unknown, message: string): asserts value {
//   if (!value) {
//     throw new Error(message)
//   }
// }
