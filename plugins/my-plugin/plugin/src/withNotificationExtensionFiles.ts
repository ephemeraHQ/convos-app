import assert from "assert"
import fs from "fs"
import path from "path"
import { withDangerousMod, type ConfigPlugin } from "@expo/config-plugins"
import plist from "plist"
import { EXTENSION_DIR, EXTENSION_NAME, INFO_PLIST_FILENAME } from "./constants/constants"

const APP_GROUP_KEY = "com.apple.security.application-groups"
const CF_BUNDLE_VERSION_KEY = "CFBundleVersion"
const CF_BUNDLE_SHORT_VERSION_STRING_KEY = "CFBundleShortVersionString"
const CF_BUNDLE_VERSION_PLACEHOLDER = "{{CONVOS_BUILD_NUMBER}}"
const CF_BUNDLE_SHORT_VERSION_STRING_PLACEHOLDER = "{{CONVOS_MARKETING_VERSION}}"

/**
 * Expo Config Plugin to manage files for the Notification Service Extension (NSE).
 * - Copies necessary Swift/Plist/Entitlements files into the native iOS project.
 * - Modifies the copied NSE entitlements file to add the correct App Group ID.
 * - Modifies the copied NSE Info.plist file to inject the correct version numbers.
 */
export const withNotificationExtensionFiles: ConfigPlugin = (config) => {
  let appGroupIdentifier: string | undefined
  const existingEntitlementsGroups = config.ios?.entitlements?.[APP_GROUP_KEY]
  if (Array.isArray(existingEntitlementsGroups) && existingEntitlementsGroups.length > 0) {
    appGroupIdentifier = existingEntitlementsGroups[0]
  } else {
    assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier'.")
    appGroupIdentifier = `group.${config.ios.bundleIdentifier}`
  }
  assert(appGroupIdentifier, "Could not determine App Group identifier.")

  const marketingVersion = config.version
  const currentProjectVersion = config.ios?.buildNumber ?? "1"

  assert(marketingVersion, "Missing 'version' in app config.")
  assert(currentProjectVersion, "Missing 'ios.buildNumber' in app config. Defaulting failed.")

  console.log(
    `[withNotificationExtensionFiles] Determined Versions: Marketing=${marketingVersion}, Build=${currentProjectVersion}`,
  )

  return withDangerousMod(config, [
    "ios",
    (mod) => {
      const { projectRoot, platformProjectRoot } = mod.modRequest
      const srcDir = path.join(projectRoot, "plugins/my-plugin", EXTENSION_DIR)
      const dstDir = path.join(platformProjectRoot, EXTENSION_NAME)

      console.log(`[withNotificationExtensionFiles] Source directory: ${srcDir}`)
      console.log(`[withNotificationExtensionFiles] Destination directory: ${dstDir}`)

      if (!fs.existsSync(dstDir)) {
        console.log(`[withNotificationExtensionFiles] Creating destination directory: ${dstDir}`)
        fs.mkdirSync(dstDir)
      } else {
        console.log(
          `[withNotificationExtensionFiles] Destination directory already exists: ${dstDir}`,
        )
      }

      try {
        const filesInSrc = fs.readdirSync(srcDir)
        console.log(
          `[withNotificationExtensionFiles] Files found in source: ${filesInSrc.join(", ")}`,
        )

        for (const file of filesInSrc) {
          const srcFilePath = path.join(srcDir, file)
          const dstFilePath = path.join(dstDir, file)
          try {
            console.log(
              `[withNotificationExtensionFiles] Attempting to copy ${srcFilePath} to ${dstFilePath}`,
            )
            fs.copyFileSync(srcFilePath, dstFilePath)
            console.log(`[withNotificationExtensionFiles] Successfully copied ${file}`)

            if (file === `${EXTENSION_NAME}.entitlements`) {
              console.log(
                `[withNotificationExtensionFiles] Modifying copied entitlements: ${dstFilePath}`,
              )
              try {
                const entitlementsContent = fs.readFileSync(dstFilePath, "utf8")
                const entitlementsPlist = plist.parse(entitlementsContent) as plist.PlistObject
                entitlementsPlist[APP_GROUP_KEY] = entitlementsPlist[APP_GROUP_KEY] || []
                const groups = entitlementsPlist[APP_GROUP_KEY] as string[]
                if (!groups.includes(appGroupIdentifier!)) {
                  groups.push(appGroupIdentifier!)
                  fs.writeFileSync(dstFilePath, plist.build(entitlementsPlist, { indent: "\t" }))
                  console.log(
                    `[withNotificationExtensionFiles] Added App Group ${appGroupIdentifier} to NSE entitlements: ${dstFilePath}`,
                  )
                }
              } catch (modifyError) {
                console.error(
                  `[withNotificationExtensionFiles] Failed to modify entitlements ${dstFilePath}:`,
                  modifyError,
                )
              }
            }

            if (file === INFO_PLIST_FILENAME) {
              console.log(
                `[withNotificationExtensionFiles] Modifying copied Info.plist for version placeholders: ${dstFilePath}`,
              )
              try {
                let plistContent = fs.readFileSync(dstFilePath, "utf8")

                const originalLength = plistContent.length
                plistContent = plistContent.replace(
                  CF_BUNDLE_VERSION_PLACEHOLDER,
                  currentProjectVersion,
                )
                plistContent = plistContent.replace(
                  CF_BUNDLE_SHORT_VERSION_STRING_PLACEHOLDER,
                  marketingVersion,
                )

                if (plistContent.length !== originalLength) {
                  fs.writeFileSync(dstFilePath, plistContent)
                  console.log(
                    `[withNotificationExtensionFiles] Successfully replaced version placeholders in Info.plist: ${dstFilePath}`,
                  )
                  console.log(`  - Final ${CF_BUNDLE_VERSION_KEY}: ${currentProjectVersion}`)
                  console.log(
                    `  - Final ${CF_BUNDLE_SHORT_VERSION_STRING_KEY}: ${marketingVersion}`,
                  )
                } else {
                  console.warn(
                    `[withNotificationExtensionFiles] Did not find version placeholders in ${dstFilePath}. Content unchanged.`,
                  )
                }
              } catch (modifyError) {
                console.error(
                  `[withNotificationExtensionFiles] Failed to modify Info.plist ${dstFilePath}:`,
                  modifyError,
                )
              }
            }
          } catch (copyError) {
            console.error(`[withNotificationExtensionFiles] Failed to copy ${file}:`, copyError)
          }
        }
      } catch (readError) {
        console.error(
          `[withNotificationExtensionFiles] Failed to read source directory ${srcDir}:`,
          readError,
        )
      }

      return mod
    },
  ])
}
