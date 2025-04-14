import { queryOptions } from "@tanstack/react-query"
import { getAppConfig } from "@/features/app-settings/app-settings.api"

export function getAppSettingsQueryOptions() {
  return queryOptions({
    queryKey: ["app-settings"],
    queryFn: getAppConfig,
    meta: {
      persist: false,
    },
  })
}
