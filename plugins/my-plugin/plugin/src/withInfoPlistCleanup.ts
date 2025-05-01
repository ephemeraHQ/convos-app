import assert from "assert"
import path from "path"
import { withXcodeProject, type ConfigPlugin } from "@expo/config-plugins"
import { EXTENSION_NAME } from "./constants"

/**
 * Ensures the main app's Info.plist is NOT in the "Copy Bundle Resources" build phase,
 * and specifically removes any reference to the NSE's Info.plist from that phase.
 */
export const withInfoPlistCleanup: ConfigPlugin = (config) => {
  const appNameFromConfig = config.name
  assert(
    appNameFromConfig,
    "[withInfoPlistCleanup] Could not determine app name (config.name is missing).",
  )
  const targetNameToFind = appNameFromConfig.replace(/\s/g, "").toLowerCase()

  console.log(
    `[withInfoPlistCleanup] Running cleanup. App name: ${appNameFromConfig}, Target lookup name: ${targetNameToFind}`,
  )

  return withXcodeProject(config, (mod) => {
    // Add a log right at the start to confirm this code is running
    console.log("[withInfoPlistCleanup] Inside withXcodeProject callback - latest version.")

    const xcodeProject = mod.modResults
    const project = xcodeProject.getFirstProject().firstProject
    const allTargets = project.targets || []

    let mainTargetObject: any = null
    let mainTargetUUID: string | null = null
    let foundTargetName: string | null = null

    console.log("[withInfoPlistCleanup] Iterating through project targets...")
    for (const targetRef of allTargets) {
      const currentTargetName = targetRef.comment || ""
      const currentTargetNameNormalized = currentTargetName.replace(/\s/g, "").toLowerCase()
      // console.log(`  - Checking TargetRef: UUID=${targetRef.value}, Name='${currentTargetName}' (Normalized='${currentTargetNameNormalized}')`) // Keep this commented unless needed
      if (currentTargetNameNormalized === targetNameToFind) {
        mainTargetUUID = targetRef.value
        // Lookup target object from the correct section using UUID
        mainTargetObject = xcodeProject.hash.project.objects["PBXNativeTarget"]?.[mainTargetUUID]
        foundTargetName = currentTargetName
        console.log(`    -> MATCH FOUND! Using Target UUID: ${mainTargetUUID}`)
        break
      }
    }

    if (!mainTargetObject || !mainTargetUUID) {
      const targetNames = allTargets.map((t: any) => t.comment || "Unknown")
      console.warn(
        `[withInfoPlistCleanup] Could not find main target matching '${targetNameToFind}' by iterating. Existing targets: ${targetNames.join(", ")}. Skipping cleanup.`,
      )
      return mod
    }
    console.log(
      `[withInfoPlistCleanup] Found main target by iteration: ${foundTargetName} (UUID: ${mainTargetUUID})`,
    )

    // --- Correctly get all build phase objects from the project's object dictionary ---
    const objects = xcodeProject.hash.project.objects
    const allBuildPhases = {
      ...(objects["PBXResourcesBuildPhase"] || {}),
      ...(objects["PBXCopyFilesBuildPhase"] || {}),
      ...(objects["PBXFrameworksBuildPhase"] || {}),
      ...(objects["PBXSourcesBuildPhase"] || {}),
      ...(objects["PBXHeadersBuildPhase"] || {}),
      ...(objects["PBXShellScriptBuildPhase"] || {}),
    }
    // --- End Corrected Phase Lookup ---

    const mainTargetPhaseRefs = mainTargetObject.buildPhases || [] // References containing UUIDs
    console.log(
      `[withInfoPlistCleanup] Main target build phase refs (UUIDs): ${mainTargetPhaseRefs.map((bp: any) => bp.value).join(", ")}`,
    )

    let phaseFound = false
    let entryRemoved = false

    // Iterate through the PHASE REFERENCES (UUIDs) attached to the target
    for (const phaseRef of mainTargetPhaseRefs) {
      const phaseUUID = phaseRef.value
      // Look up the full phase object using its UUID from the combined dictionary
      const phase = allBuildPhases[phaseUUID]

      if (!phase) {
        console.log(
          `[withInfoPlistCleanup] Could not find phase object for UUID: ${phaseUUID}. Skipping.`,
        )
        continue
      }

      // console.log( `[withInfoPlistCleanup] Checking phase: UUID=${phaseUUID}, Type=${phase.isa}, Name=${phase.name || "N/A"}` ) // Keep commented unless needed

      // Target the main 'Resources' build phase (Copy Bundle Resources)
      if (
        phase.isa === "PBXResourcesBuildPhase" &&
        (phase.name === '"Resources"' || phase.name === "Resources" || !phase.name)
      ) {
        phaseFound = true
        console.log(
          `[withInfoPlistCleanup] Found 'Copy Bundle Resources' phase: UUID=${phaseUUID}, Name=${phase.name || "N/A"}`,
        )
        console.log(
          `[withInfoPlistCleanup] Files currently in phase (${phase.files?.length || 0}):`,
        )

        const nsePlistPathFragment = path.join(EXTENSION_NAME, "Info.plist")
        const filesToRemove: any[] = []

        for (const file of phase.files || []) {
          const comment = file.comment || ""
          const fileRefComment = file.fileRef_comment || ""
          // console.log(`  - File: Comment='${comment}', FileRefComment='${fileRefComment}'`) // Keep commented unless needed

          if (
            comment.includes(nsePlistPathFragment) ||
            fileRefComment.includes(nsePlistPathFragment)
          ) {
            console.log(`    -> MATCHED NSE Plist entry for removal: ${comment || fileRefComment}`)
            filesToRemove.push(file)
          }
        }

        if (filesToRemove.length > 0) {
          console.log(
            `[withInfoPlistCleanup] Removing ${filesToRemove.length} incorrect NSE Info.plist reference(s).`,
          )
          phase.files = phase.files.filter((file: any) => !filesToRemove.includes(file))
          entryRemoved = true
          console.log(
            `[withInfoPlistCleanup] Files remaining in phase (${phase.files?.length || 0}).`,
          )
        } else {
          console.log(
            `[withInfoPlistCleanup] No NSE Info.plist entries found to remove in this phase.`,
          )
        }
        // Since there should only be one 'Copy Bundle Resources' phase per target, we can break after finding it
        break
      }
    }

    if (!phaseFound) {
      console.warn(
        `[withInfoPlistCleanup] Did not find a 'PBXResourcesBuildPhase' for the main target.`,
      )
    }
    if (phaseFound && !entryRemoved) {
      console.warn(
        `[withInfoPlistCleanup] Found the Resources phase, but did not find any entries referencing '${path.join(EXTENSION_NAME, "Info.plist")}' to remove.`,
      )
    }

    return mod
  })
}
