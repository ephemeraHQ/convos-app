import { IXmtpConversationId, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query"
import { matchSorter } from "match-sorter"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getAllowedConsentConversationsQueryData } from "@/features/conversation/conversation-list/conversations-allowed-consent.query"
import { getConversationQueryData } from "@/features/conversation/queries/conversation.query"
import { isConversationGroup } from "@/features/conversation/utils/is-conversation-group"
import { ensureProfileQueryData } from "@/features/profiles/profiles.query"
import { doesSocialProfilesMatchTextQuery } from "@/features/profiles/utils/does-social-profiles-match-text-query"
import { ensureSocialProfilesForAddressQuery } from "@/features/social-profiles/social-profiles.query"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { normalizeString } from "@/utils/str"

export async function searchExistingGroupsByGroupMembers(args: { searchQuery: string }) {
  const { searchQuery } = args

  const currentSender = getSafeCurrentSender()

  const conversationIds = getAllowedConsentConversationsQueryData({
    clientInboxId: currentSender.inboxId,
  })

  const conversations = conversationIds
    ?.map((conversationId) =>
      getConversationQueryData({
        clientInboxId: currentSender.inboxId,
        xmtpConversationId: conversationId,
      }),
    )
    .filter(Boolean)

  if (!conversations || !searchQuery) {
    return []
  }

  const matchingXmtpConversationIds: IXmtpConversationId[] = []

  await Promise.all(
    conversations.filter(isConversationGroup).map(async (group) => {
      try {
        // const otherMembersInboxIds = group.members.ids.filter((id) => id !== searcherInboxId)
        // For now only search for members that we allowed otherwise we're doing too many requests!
        const otherMemberInboxIdsWithAllowedConsent = Object.values(group.members.byId)
          .filter((member) => member.consentState === "allowed")
          .map((member) => member.inboxId)

        if (otherMemberInboxIdsWithAllowedConsent.length === 0) {
          return
        }

        // Use Promise.race to get the first matching member
        const result = await Promise.race([
          ...otherMemberInboxIdsWithAllowedConsent.map(async (inboxId) => {
            const profile = await ensureProfileQueryData({
              xmtpId: inboxId,
              caller: "SearchExistingGroupsByGroupMembers",
            })

            if (!profile) {
              return false
            }

            if (matchSorter([profile.name, profile.username], searchQuery).length > 0) {
              return true
            }

            const socialProfiles = await ensureSocialProfilesForAddressQuery({
              ethAddress: profile.turnkeyAddress,
              caller: "SearchExistingGroupsByGroupMembers",
            })

            if (!socialProfiles) {
              return false
            }

            return doesSocialProfilesMatchTextQuery({
              socialProfiles,
              normalizedQuery: searchQuery,
            })
          }),
        ])

        if (result) {
          matchingXmtpConversationIds.push(group.xmtpId)
        }
      } catch (error) {
        captureError(
          new GenericError({
            error,
            additionalMessage: "Error searching existing groups by group members",
          }),
        )
      }
    }),
  )

  return matchingXmtpConversationIds
}

export function getSearchExistingGroupsByGroupMembersQueryOptions(args: {
  searchQuery: string
  searcherInboxId: IXmtpInboxId
}) {
  const { searchQuery, searcherInboxId } = args
  const normalizedSearchQuery = normalizeString(searchQuery)
  return queryOptions({
    queryKey: ["search-existing-groups-by-group-members", normalizedSearchQuery, searcherInboxId],
    queryFn: () => {
      return searchExistingGroupsByGroupMembers({
        searchQuery: normalizedSearchQuery,
      })
    },
    enabled: !!normalizedSearchQuery && !!searcherInboxId,
    staleTime: 0,
    // Keep showing previous search results while new results load
    // to prevent UI flicker during search
    placeholderData: keepPreviousData,
  })
}

export function useSearchExistingGroupsByGroupMembersQuery(args: {
  searchQuery: string
  searcherInboxId: IXmtpInboxId
}) {
  return useQuery(getSearchExistingGroupsByGroupMembersQueryOptions(args))
}
