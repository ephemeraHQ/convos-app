import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useStableArray } from "@/features/conversation/hooks/use-stable-array"
import {
  getPreferredAvatarUrl,
  getPreferredDisplayName,
  getPreferredEthAddress,
} from "@/features/preferred-display-info/preferred-display-info.utils"
import { getProfileQueryConfig } from "@/features/profiles/profiles.query"
import { getSocialProfilesForInboxIdQueryOptions } from "@/features/social-profiles/social-profiles-for-inbox-id.query"

export function usePreferredDisplayInfoBatch(args: { xmtpInboxIds: IXmtpInboxId[] }) {
  const { xmtpInboxIds } = args

  // Get a stable reference to the inbox IDs
  const stableInboxIds = useStableArray(xmtpInboxIds)

  const currentSender = useSafeCurrentSender()

  // Memoize the profile queries configuration
  const profileQueryConfigs = useMemo(
    () =>
      stableInboxIds.map((inboxId) => ({
        ...getProfileQueryConfig({ xmtpId: inboxId, caller: "usePreferredDisplayInfoBatch" }),
      })),
    [stableInboxIds],
  )

  // Memoize the social profile queries configuration
  const socialProfileQueryConfigs = useMemo(
    () =>
      stableInboxIds.map((inboxId) =>
        getSocialProfilesForInboxIdQueryOptions({
          inboxId,
          clientInboxId: currentSender.inboxId,
          caller: "usePreferredDisplayInfoBatch",
        }),
      ),
    [stableInboxIds, currentSender.inboxId],
  )

  // Execute the profile queries
  const profileQueries = useQueries({
    queries: profileQueryConfigs,
    combine: (results) => ({
      data: results.map((result) => result.data),
      isLoading: results.some((result) => result.isLoading),
    }),
  })

  // Execute the social profile queries
  const socialProfileQueries = useQueries({
    queries: socialProfileQueryConfigs,
    combine: (results) => ({
      data: results.map((result) => result.data),
      isLoading: results.some((result) => result.isLoading),
    }),
  })

  // Memoize the final result to prevent unnecessary recalculations
  return useMemo(() => {
    return stableInboxIds.map((inboxId, index) => {
      const profile = profileQueries.data[index]
      const socialProfiles = socialProfileQueries.data[index]

      const displayName = getPreferredDisplayName({
        profile,
        socialProfiles,
        inboxId,
        ethAddress: profile?.privyAddress,
      })

      const avatarUrl = getPreferredAvatarUrl({
        profile,
        socialProfiles,
      })

      const ethAddress = getPreferredEthAddress({
        profile,
        socialProfiles,
        ethAddress: profile?.privyAddress,
      })

      const username = profile?.username

      return {
        ethAddress,
        inboxId,
        displayName,
        avatarUrl,
        username,
        isLoading: profileQueries.isLoading || socialProfileQueries.isLoading,
      }
    })
  }, [
    stableInboxIds,
    profileQueries.data,
    profileQueries.isLoading,
    socialProfileQueries.data,
    socialProfileQueries.isLoading,
  ])
}
