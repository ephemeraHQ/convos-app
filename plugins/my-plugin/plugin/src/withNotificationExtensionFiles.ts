// import assert from "assert"
// import fs from "fs"
// import path from "path"
// import { withDangerousMod, type ConfigPlugin } from "@expo/config-plugins"
// import plist from "plist"
// import { EXTENSION_DIR, EXTENSION_NAME, INFO_PLIST_FILENAME } from "./constants"

// const APP_GROUP_KEY = "com.apple.security.application-groups"
// const CF_BUNDLE_VERSION_KEY = "CFBundleVersion"
// const CF_BUNDLE_SHORT_VERSION_STRING_KEY = "CFBundleShortVersionString"
// const CF_BUNDLE_VERSION_PLACEHOLDER = "{{CONVOS_BUILD_NUMBER}}"
// const CF_BUNDLE_SHORT_VERSION_STRING_PLACEHOLDER = "{{CONVOS_MARKETING_VERSION}}"
// const XMTP_ENVIRONMENT_KEY = "XmtpEnvironment"

// /**
//  * Expo Config Plugin to manage files for the Notification Service Extension (NSE).
//  * - Copies necessary Swift/Plist/Entitlements files into the native iOS project.
//  * - Modifies the copied NSE entitlements file to add the correct App Group ID.
//  * - Modifies the copied NSE Info.plist file to inject the correct version numbers.
//  */
// export const withNotificationExtensionFiles: ConfigPlugin = (config) => {
//   let appGroupIdentifier: string | undefined
//   const existingEntitlementsGroups = config.ios?.entitlements?.[APP_GROUP_KEY]
//   if (Array.isArray(existingEntitlementsGroups) && existingEntitlementsGroups.length > 0) {
//     appGroupIdentifier = existingEntitlementsGroups[0]
//   } else {
//     assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier'.")
//     appGroupIdentifier = `group.${config.ios.bundleIdentifier}`
//   }
//   assert(appGroupIdentifier, "Could not determine App Group identifier.")

//   const marketingVersion = config.version
//   const currentProjectVersion = config.ios?.buildNumber ?? "1"

//   assert(marketingVersion, "Missing 'version' in app config.")
//   assert(currentProjectVersion, "Missing 'ios.buildNumber' in app config. Defaulting failed.")

//   const xmtpEnv = (config.extra as any)?.xmtp?.env ?? "production"
//   assert(
//     ["production", "dev", "local"].includes(xmtpEnv),
//     `Invalid XMTP environment in config: ${xmtpEnv}`,
//   )

//   console.log(
//     `[withNotificationExtensionFiles] Config: Group=${appGroupIdentifier}, MarketingVer=${marketingVersion}, BuildVer=${currentProjectVersion}, XmtpEnv=${xmtpEnv}`,
//   )

//   return withDangerousMod(config, [
//     "ios",
//     (mod) => {
//       const { projectRoot, platformProjectRoot } = mod.modRequest
//       const srcDir = path.join(projectRoot, "plugins/my-plugin", EXTENSION_DIR)
//       const dstDir = path.join(platformProjectRoot, EXTENSION_NAME)

//       console.log(`[withNotificationExtensionFiles] Source directory: ${srcDir}`)
//       console.log(`[withNotificationExtensionFiles] Destination directory: ${dstDir}`)

//       if (!fs.existsSync(dstDir)) {
//         console.log(`[withNotificationExtensionFiles] Creating destination directory: ${dstDir}`)
//         fs.mkdirSync(dstDir)
//       } else {
//         console.log(
//           `[withNotificationExtensionFiles] Destination directory already exists: ${dstDir}`,
//         )
//       }

//       try {
//         const filesInSrc = fs.readdirSync(srcDir)
//         console.log(
//           `[withNotificationExtensionFiles] Files found in source: ${filesInSrc.join(", ")}`,
//         )

//         for (const file of filesInSrc) {
//           const srcFilePath = path.join(srcDir, file)
//           const dstFilePath = path.join(dstDir, file)
//           try {
//             console.log(
//               `[withNotificationExtensionFiles] Attempting to copy ${srcFilePath} to ${dstFilePath}`,
//             )
//             fs.copyFileSync(srcFilePath, dstFilePath)
//             console.log(`[withNotificationExtensionFiles] Successfully copied ${file}`)

//             if (file === `${EXTENSION_NAME}.entitlements`) {
//               console.log(
//                 `[withNotificationExtensionFiles] Modifying copied entitlements: ${dstFilePath}`,
//               )
//               try {
//                 const entitlementsContent = fs.readFileSync(dstFilePath, "utf8")
//                 const entitlementsPlist = plist.parse(entitlementsContent) as plist.PlistObject
//                 entitlementsPlist[APP_GROUP_KEY] = entitlementsPlist[APP_GROUP_KEY] || []
//                 const groups = entitlementsPlist[APP_GROUP_KEY] as string[]
//                 if (!groups.includes(appGroupIdentifier!)) {
//                   groups.push(appGroupIdentifier!)
//                   fs.writeFileSync(dstFilePath, plist.build(entitlementsPlist, { indent: "\t" }))
//                   console.log(
//                     `[withNotificationExtensionFiles] Added App Group ${appGroupIdentifier} to NSE entitlements: ${dstFilePath}`,
//                   )
//                 }
//               } catch (modifyError) {
//                 console.error(
//                   `[withNotificationExtensionFiles] Failed to modify entitlements ${dstFilePath}:`,
//                   modifyError,
//                 )
//               }
//             }

//             if (file === INFO_PLIST_FILENAME) {
//               console.log(
//                 `[withNotificationExtensionFiles] Modifying copied Info.plist: ${dstFilePath}`,
//               )
//               try {
//                 const plistContent = fs.readFileSync(dstFilePath, "utf8")
//                 const plistObject = plist.parse(plistContent) as plist.PlistObject
//                 let modified = false

//                 if (plistObject[CF_BUNDLE_VERSION_KEY] === CF_BUNDLE_VERSION_PLACEHOLDER) {
//                   plistObject[CF_BUNDLE_VERSION_KEY] = currentProjectVersion
//                   console.log(`  - Set ${CF_BUNDLE_VERSION_KEY} to ${currentProjectVersion}`)
//                   modified = true
//                 } else {
//                   if (plistObject[CF_BUNDLE_VERSION_KEY] !== currentProjectVersion) {
//                     console.warn(
//                       `  - ${CF_BUNDLE_VERSION_KEY} in source plist was not placeholder '${CF_BUNDLE_VERSION_PLACEHOLDER}'. Actual: ${plistObject[CF_BUNDLE_VERSION_KEY]}`,
//                     )
//                   }
//                 }
//                 if (
//                   plistObject[CF_BUNDLE_SHORT_VERSION_STRING_KEY] ===
//                   CF_BUNDLE_SHORT_VERSION_STRING_PLACEHOLDER
//                 ) {
//                   plistObject[CF_BUNDLE_SHORT_VERSION_STRING_KEY] = marketingVersion
//                   console.log(
//                     `  - Set ${CF_BUNDLE_SHORT_VERSION_STRING_KEY} to ${marketingVersion}`,
//                   )
//                   modified = true
//                 } else {
//                   if (plistObject[CF_BUNDLE_SHORT_VERSION_STRING_KEY] !== marketingVersion) {
//                     console.warn(
//                       `  - ${CF_BUNDLE_SHORT_VERSION_STRING_KEY} in source plist was not placeholder '${CF_BUNDLE_SHORT_VERSION_STRING_PLACEHOLDER}'. Actual: ${plistObject[CF_BUNDLE_SHORT_VERSION_STRING_KEY]}`,
//                     )
//                   }
//                 }

//                 if (plistObject[XMTP_ENVIRONMENT_KEY] !== xmtpEnv) {
//                   plistObject[XMTP_ENVIRONMENT_KEY] = xmtpEnv
//                   console.log(`  - Set ${XMTP_ENVIRONMENT_KEY} to ${xmtpEnv}`)
//                   modified = true
//                 }

//                 if (modified) {
//                   fs.writeFileSync(dstFilePath, plist.build(plistObject, { indent: "\t" }))
//                   console.log(
//                     `[withNotificationExtensionFiles] Successfully updated Info.plist: ${dstFilePath}`,
//                   )
//                 } else {
//                   console.log(
//                     `[withNotificationExtensionFiles] Info.plist already up-to-date: ${dstFilePath}`,
//                   )
//                 }
//               } catch (modifyError) {
//                 console.error(
//                   `[withNotificationExtensionFiles] Failed to modify Info.plist ${dstFilePath}:`,
//                   modifyError,
//                 )
//               }
//             }
//           } catch (copyError) {
//             console.error(`[withNotificationExtensionFiles] Failed to copy ${file}:`, copyError)
//           }
//         }
//       } catch (readError) {
//         console.error(
//           `[withNotificationExtensionFiles] Failed to read source directory ${srcDir}:`,
//           readError,
//         )
//       }

//       return mod
//     },
//   ])
// }
