import { ConfigPlugin } from "@expo/config-plugins"
import { withXcodeProject } from "expo/config-plugins"
import { getShareExtensionBundleIdentifier, getShareExtensionName } from "./helpers/utils"
import { addBuildPhases } from "./xcode/add-build-phases"
import { addPbxGroup } from "./xcode/add-pbx-group"
import { addProductFile } from "./xcode/add-product-file"
import { addTargetDependency } from "./xcode/add-target-dependency"
import { addToPbxNativeTargetSection } from "./xcode/add-to-pbx-native-target-section"
import { addToPbxProjectSection } from "./xcode/add-to-pbx-project-section"
import { addToXCConfigurationList } from "./xcode/add-to-xc-configuration-list"

export const withNSETarget: ConfigPlugin = (config) => {
  return withXcodeProject(config, async (config) => {
    console.log("Starting withNSETarget")

    const xcodeProject = config.modResults

    const targetName = getShareExtensionName(config)
    const bundleIdentifier = getShareExtensionBundleIdentifier(config)
    console.log("Bundle identifier:", bundleIdentifier)
    const marketingVersion = config.version
    console.log("Marketing version:", marketingVersion)

    const targetUuid = xcodeProject.generateUuid()
    console.log("Generated target UUID:", targetUuid)
    const groupName = "Embed Foundation Extensions"
    console.log("Group name:", groupName)

    const xCConfigurationList = addToXCConfigurationList(xcodeProject, {
      targetName,
      currentProjectVersion: config.ios?.buildNumber || "1",
      bundleIdentifier,
      marketingVersion,
    })
    console.log("Added XCConfigurationList:", xCConfigurationList)

    const productFile = addProductFile(xcodeProject, {
      targetName,
      groupName,
    })
    console.log("Added product file:", productFile)

    const target = addToPbxNativeTargetSection(xcodeProject, {
      targetName,
      targetUuid,
      productFile,
      xCConfigurationList,
    })
    console.log("Added target to PBX native target section:", target)

    addToPbxProjectSection(xcodeProject, target)
    console.log("Added target to PBX project section")

    addTargetDependency(xcodeProject, target)
    console.log("Added target dependency")

    addPbxGroup(xcodeProject, {
      targetName,
      platformProjectRoot: config.modRequest?.projectRoot,
    })
    console.log("Added PBX group")

    addBuildPhases(xcodeProject, {
      targetUuid,
      groupName,
      productFile,
      resources: [],
    })
    console.log("Added build phases")

    console.log("Finished withNSETarget")

    return config
  })
}
