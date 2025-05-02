import fs from "fs"
import path from "path"
import { ConfigPlugin, withDangerousMod } from "@expo/config-plugins"
import { EXTENSION_NAME } from "./constants/constants"

/**
 * Modifies the Podfile to add the NSE target and link necessary pods.
 */
export const withNSEPodfileTarget: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, "Podfile")
      let podfileContent = fs.readFileSync(podfilePath, "utf-8")

      // Check if the target is already added (idempotency)
      if (podfileContent.includes(`target '${EXTENSION_NAME}' do`)) {
        console.log(
          `[withNSEPodfileTarget] NSE target '${EXTENSION_NAME}' already exists in Podfile. Skipping.`,
        )
        return modConfig
      }

      // Find the main target's end line to insert after it
      // Adjust 'ConvosDev' if your main target name derived from config.name is different
      const appName =
        modConfig.modRequest.projectName?.replace(/\s/g, "") ?? config.name?.replace(/\s/g, "") // Get spaceless name
      assert(appName, "[withNSEPodfileTarget] Could not determine main app target name.")
      const mainTargetEndMarker = `target '${appName}' do`
      const insertionPoint = podfileContent.indexOf(mainTargetEndMarker)

      if (insertionPoint === -1) {
        console.warn(
          `[withNSEPodfileTarget] Could not find main target '${appName}' block in Podfile. Appending target to end.`,
        )
        // Append if main target block isn't found (less ideal)
        podfileContent += "\n" + generateNseTargetBlock()
      } else {
        // Find the 'end' corresponding to the main target block
        const endMarker = "\nend\n"
        const endOfMainTarget = podfileContent.indexOf(endMarker, insertionPoint)

        if (endOfMainTarget === -1) {
          console.warn(
            `[withNSEPodfileTarget] Could not find 'end' for main target '${appName}' block in Podfile. Appending target to end.`,
          )
          podfileContent += "\n" + generateNseTargetBlock()
        } else {
          // Insert the NSE target block after the main target's 'end'
          const insertIndex = endOfMainTarget + endMarker.length
          podfileContent =
            podfileContent.slice(0, insertIndex) +
            generateNseTargetBlock() +
            podfileContent.slice(insertIndex)
          console.log(`[withNSEPodfileTarget] Added NSE target block to Podfile after main target.`)
        }
      }

      fs.writeFileSync(podfilePath, podfileContent)
      return modConfig
    },
  ])
}

// Helper function to generate the Podfile target block content
function generateNseTargetBlock(): string {
  // Important: Extensions often require dynamic frameworks.
  // Check if your main app uses `use_frameworks! :linkage => :static`.
  // If so, this might need adjustment or cause conflicts.
  // If main app uses `use_modular_headers!`, this should be okay.
  // Let's assume dynamic frameworks are okay for the extension for now.
  const useFrameworksLine = "  use_frameworks!" // Or potentially use_frameworks! :linkage => :static

  // Define the pods needed by NotificationService.swift
  // Start with just inheriting search paths, add specific pods if needed.
  // Check Pods/Target Support Files/Pods-ConvosNSE/Pods-ConvosNSE.debug.xcconfig after failed pod install if XMTP module is still not found.
  const podLines = [
    "# Add pods required by the Notification Service Extension here",
    "# inherit! :search_paths # Inherits search paths from main target, usually needed",
    "# pod 'XMTP', :path => '../node_modules/@xmtp/react-native-sdk' # Example if specific pod needed",
    "# pod 'LibXMTP' # Another possible name",
  ]
    .map((line) => `  ${line}`)
    .join("\n") // Indent lines

  return `

target '${EXTENSION_NAME}' do
${useFrameworksLine}
${podLines}
end
`
}

// Helper assertion function (or import if you have a shared one)
function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
