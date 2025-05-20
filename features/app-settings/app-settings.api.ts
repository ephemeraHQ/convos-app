import { z } from "zod"
import { captureError } from "@/utils/capture-error"
import { ConvosApiError } from "@/utils/convos-api/convos-api-error"
import { convosPublicApi } from "@/utils/convos-api/convos-api-instance"

export const AppConfigSchema = z.object({
  minimumAppVersion: z.object({
    ios: z.object({
      version: z.string(),
      buildNumber: z.string(),
    }),
    android: z.object({
      version: z.string(),
      buildNumber: z.string(),
    }),
  }),
})

export type IAppConfig = z.infer<typeof AppConfigSchema>

export async function getAppConfig() {
  try {
    const { data } = await convosPublicApi.get<IAppConfig>("/api/v1/app-config")
    const result = AppConfigSchema.safeParse(data)
    if (!result.success) {
      captureError(new ConvosApiError({ error: result.error }))
    }
    return data
  } catch (error) {
    captureError(new ConvosApiError({ error }))
    throw error
  }
}
