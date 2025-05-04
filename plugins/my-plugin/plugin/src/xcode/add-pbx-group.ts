import fs from "fs"
import path from "path"
import { XcodeProject } from "expo/config-plugins"

const SWIFT_FILE_NAMES = [
  "Keychain.swift",
  "NotificationService.swift",
  "Utils.swift",
  "Info.plist",
  "ConvosNSE.entitlements",
]

export function addPbxGroup(
  xcodeProject: XcodeProject,
  {
    targetName,
    platformProjectRoot,
  }: {
    targetName: string
    platformProjectRoot: string
  },
) {
  const targetPath = path.join(platformProjectRoot, targetName)

  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true })
  }

  for (const file of SWIFT_FILE_NAMES) {
    const src = path.join(__dirname, "../../swift", file)
    copyFileSync(src, targetPath, file)
  }

  const files = SWIFT_FILE_NAMES.map((file) => path.basename(file))

  // Add PBX group
  const { uuid: pbxGroupUuid } = xcodeProject.addPbxGroup(files, targetName, targetName)

  // Add PBXGroup to top level group
  const groups = xcodeProject.hash.project.objects["PBXGroup"]
  if (pbxGroupUuid) {
    Object.keys(groups).forEach(function (key) {
      if (groups[key].name === undefined && groups[key].path === undefined) {
        xcodeProject.addToPbxGroup(pbxGroupUuid, key)
      }
    })
  }
}

function copyFileSync(source: string, target: string, basename?: string) {
  let targetFile = target

  if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
    targetFile = path.join(target, basename ?? path.basename(source))
  }

  fs.writeFileSync(targetFile, fs.readFileSync(source))
}
