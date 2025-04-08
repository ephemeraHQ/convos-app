import { convosApi, convosPublicApi } from "@/utils/convos-api/convos-api-instance"
import { apiLogger } from "@/utils/logger/logger"

let requestInterceptorId: number | null = null
let publicRequestInterceptorId: number | null = null

export function setupConvosApiDebugInterceptor() {
  // Clean up existing interceptors if they exist
  if (requestInterceptorId !== null) {
    convosApi.interceptors.request.eject(requestInterceptorId)
  }
  if (publicRequestInterceptorId !== null) {
    convosPublicApi.interceptors.request.eject(publicRequestInterceptorId)
  }

  // Debug interceptor for authenticated API
  requestInterceptorId = convosApi.interceptors.request.use((config) => {
    apiLogger.debug(
      `New request`,
      // `New request URL: ${config.url}, method: ${config.method}, body: ${JSON.stringify(
      //   config.data ?? "",
      // )}, params: ${JSON.stringify(config.params ?? "")}`,
      {
        url: config.url,
        method: config.method,
        ...(config.data && { body: config.data }),
        ...(config.params && { params: config.params }),
      },
    )

    return config
  })

  // Debug interceptor for public API
  publicRequestInterceptorId = convosPublicApi.interceptors.request.use((config) => {
    apiLogger.debug(
      `New public request`,
      // `New Public API request. URL: ${config.url}, method: ${config.method}, body: ${JSON.stringify(
      //   config.data ?? "",
      // )}, params: ${JSON.stringify(config.params ?? "")}`,
      {
        url: config.url,
        method: config.method,
        ...(config.data && { body: config.data }),
        ...(config.params && { params: config.params }),
      },
    )

    return config
  })
}
