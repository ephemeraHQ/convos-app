import { XcodeProject } from "expo/config-plugins"
import { PRODUCT_TYPE } from "../constants"

export function addToPbxNativeTargetSection(
  xcodeProject: XcodeProject,
  {
    targetName,
    targetUuid,
    productFile,
    xCConfigurationList,
  }: {
    targetName: string
    targetUuid: string
    productFile: { fileRef: string }
    xCConfigurationList: { uuid: string }
  },
) {
  const target = {
    uuid: targetUuid,
    pbxNativeTarget: {
      isa: "PBXNativeTarget",
      name: targetName,
      productName: targetName,
      productReference: productFile.fileRef,
      productType: PRODUCT_TYPE,
      buildConfigurationList: xCConfigurationList.uuid,
      buildPhases: [],
      buildRules: [],
      dependencies: [],
    },
  }

  xcodeProject.addToPbxNativeTargetSection(target)

  return target
}
