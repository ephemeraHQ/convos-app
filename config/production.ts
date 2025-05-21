import { Platform } from "react-native"
import { IConfig } from "@/config/config.types"
import { shared } from "./shared"

export const productionConfig: IConfig = {
  ...shared,
  debugMenu: true,
  app: {
    ...shared.app,
    storeUrl: Platform.select({
      default: "itms-beta://testflight.apple.com/v1/app/6744714645",
      android: "TODO",
    }),
  },
} as const
