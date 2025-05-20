import { queryOptions, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import { Alert, Platform } from "react-native"
import { config } from "@/config"
import { getAppSettingsQueryOptions } from "@/features/app-settings/app-settings.query"
import { openLink } from "@/utils/linking"

function parseVersion(version: string): number[] {
  return version.split(".").map(Number)
}

// Compare version strings like "1.2.3" and build numbers like "123"
function isVersionGreaterOrEqual(args: {
  currentVersion: string
  minimumVersion: string
  currentBuildNumber: number
  minimumBuildNumber: number
}) {
  const { currentVersion, minimumVersion, currentBuildNumber, minimumBuildNumber } = args

  const current = parseVersion(currentVersion)
  const minimum = parseVersion(minimumVersion)

  // Compare version segments first since version is most important
  for (let i = 0; i < 3; i++) {
    if (current[i] > minimum[i]) {
      return true
    }
    if (current[i] < minimum[i]) {
      return false
    }
  }

  // If versions are equal, compare build numbers only for iOS
  // For Android, build numbers always increase so we only check version numbers
  if (current[0] === minimum[0] && current[1] === minimum[1] && current[2] === minimum[2]) {
    if (Platform.OS === "ios") {
      return currentBuildNumber >= minimumBuildNumber
    }
    return true // On Android, if versions match we consider it up to date
  }

  return true
}
export function useIsCurrentVersionEnough() {
  const queryOpts = useMemo(() => {
    return queryOptions({
      ...getAppSettingsQueryOptions(),
      select: (backendConfig) => {
        return isVersionGreaterOrEqual({
          currentVersion: config.app.version,
          minimumVersion: Platform.select({
            ios: backendConfig.minimumAppVersion.ios.version,
            android: backendConfig.minimumAppVersion.android.version,
            default: backendConfig.minimumAppVersion.ios.version, // TODO: web
          }),
          currentBuildNumber: config.app.buildNumber,
          minimumBuildNumber: Platform.select({
            ios: Number(backendConfig.minimumAppVersion.ios.buildNumber),
            android: Number(backendConfig.minimumAppVersion.android.buildNumber),
            default: Number(backendConfig.minimumAppVersion.ios.buildNumber), // TODO: web
          }),
        })
      },
    })
  }, [])

  const { data: currentVersionIsEnough, isFetching: isCheckingIfCurrentVersionIsEnough } =
    useQuery(queryOpts)

  useEffect(() => {
    const shouldShowUpdateAlert =
      typeof currentVersionIsEnough === "boolean" &&
      !currentVersionIsEnough &&
      !isCheckingIfCurrentVersionIsEnough &&
      !__DEV__

    if (shouldShowUpdateAlert) {
      Alert.alert("Version is out of date", "Please update to the latest version", [
        {
          text: "Update",
          onPress: () => openLink({ url: config.app.storeUrl }),
        },
      ])
    }
  }, [currentVersionIsEnough, isCheckingIfCurrentVersionIsEnough])
}
