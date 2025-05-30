import { Platform } from "react-native"
import RNFS from "react-native-fs"
import { config } from "@/config"
import { GenericError } from "@/utils/error"

export async function getSharedAppGroupDirectory() {
  if (Platform.OS !== "ios") {
    return null
  }

  try {
    const groupPath = await RNFS.pathForGroup(config.ios.appGroupId)

    if (!groupPath) {
      throw new Error("Failed to get App Group path via RNFS")
    }

    return groupPath
  } catch (error) {
    throw new GenericError({ error, additionalMessage: "Failed to get App Group path via RNFS" })
  }
}
