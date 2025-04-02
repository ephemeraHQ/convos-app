import { convosApi, convosPublicApi } from "@/utils/convos-api/convos-api-instance"
import { apiLogger } from "@/utils/logger/logger"

export function setupConvosApiDebugInterceptor() {
  // Debug interceptor for authenticated API
  convosApi.interceptors.request.use((config) => {
    apiLogger.debug(
      `New request. URL: ${config.url}, method: ${config.method}, body: ${JSON.stringify(
        config.data ?? "",
      )}, params: ${JSON.stringify(config.params ?? "")}`,
    )

    return config
  })

  // Debug interceptor for public API
  convosPublicApi.interceptors.request.use((config) => {
    apiLogger.debug(
      `New Public API request. URL: ${config.url}, method: ${config.method}, body: ${JSON.stringify(
        config.data ?? "",
      )}, params: ${JSON.stringify(config.params ?? "")}`,
    )

    return config
  })
}
