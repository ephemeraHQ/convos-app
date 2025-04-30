const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins")
const { getPbxproj } = require("@expo/config-plugins/build/ios/utils/Xcodeproj")
const { addBuildPhase, addFramework } = require("@expo/config-plugins/build/ios/utils/Xcodeproj")
const fs = require("fs")
const path = require("path")

// Basic parameters – change if needed
const TARGET_NAME = "ConvosNSE"
const GROUP_ID = "group.convos.shared"
const DEPLOYMENT_TARGET = "16.0"
const SRC_DIR = "notification-service-extension" // relative to project root

function withNotificationService(config) {
  // Copy Swift + plist once
  config = withDangerousMod(config, [
    "ios",
    (mod) => {
      const projectRoot = mod.modRequest.projectRoot
      const iosDir = path.join(projectRoot, "ios")
      const destDir = path.join(iosDir, TARGET_NAME)
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir)
        // Copy every file from source dir
        const srcDir = path.join(projectRoot, SRC_DIR)
        if (!fs.existsSync(srcDir)) {
          throw new Error(`[with-notification-service] Source dir not found: ${srcDir}`)
        }
        for (const file of fs.readdirSync(srcDir)) {
          fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file))
        }
      }
      return mod
    },
  ])

  // Add NSE target manually (minimal)
  config = withXcodeProject(config, (mod) => {
    const proj = mod.project

    // Skip if target already exists
    try {
      const { findNativeTargetByName } = require("@expo/config-plugins/build/ios/Target")
      findNativeTargetByName(proj, TARGET_NAME)
      return mod // already exists
    } catch {
      // not found, continue
    }

    const bundleId = `${config.ios?.bundleIdentifier}.${TARGET_NAME.toLowerCase()}`

    // 1. Add new PBXGroup for extension files
    const files = fs.readdirSync(path.join(mod.modRequest.projectRoot, SRC_DIR))
    const { addBuildSourceFileToGroup } = require("@expo/config-plugins/build/ios/utils/Xcodeproj")

    // Create group manually
    const group = proj.addPbxGroup([], TARGET_NAME, TARGET_NAME)
    proj
      .getFirstProject()
      .firstProject.mainGroup.children.push({ value: group.uuid, comment: TARGET_NAME })

    files.forEach((file) => {
      const filepath = path.join(TARGET_NAME, file) // relative to project
      addBuildSourceFileToGroup({
        filepath,
        groupName: TARGET_NAME,
        project: proj,
        verbose: false,
        targetUuid: undefined,
      })
    })

    // 2. Create target
    const target = proj.addTarget(TARGET_NAME, "app_extension", TARGET_NAME, bundleId)

    // 3. Add build phase with files
    proj.addBuildPhase(files, "PBXSourcesBuildPhase", "Sources", target.uuid, TARGET_NAME)

    proj.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid, TARGET_NAME)

    // 4. Deployment target setting
    const buildConfigListId = target.buildConfigurationList
    const buildConfigs = proj.pbxXCBuildConfigurationSection()
    Object.keys(buildConfigs)
      .filter((k) => !k.endsWith("_comment"))
      .forEach((key) => {
        const cfg = buildConfigs[key]
        if (cfg.buildSettings) {
          cfg.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET
        }
      })

    return mod
  })

  // Ensure App Group entitlement on main target
  config.ios = config.ios || {}
  config.ios.entitlements = {
    ...(config.ios.entitlements || {}),
    "com.apple.security.application-groups": [GROUP_ID],
  }

  return config
}

module.exports = withNotificationService
