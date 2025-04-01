import { IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { useQuery } from "@tanstack/react-query"
import { memo, useCallback } from "react"
import { Chip, ChipText } from "@/design-system/chip"
import { getSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { getGroupQueryOptions } from "@/features/groups/queries/group.query"
import { useAddGroupMembersStore } from "@/features/groups/stores/add-group-members.store"
import { SearchUsersResultsListItemUser } from "@/features/search-users/search-users-results-list-item-user"
import { useRouteParams } from "@/navigation/use-navigation"

export const AddGroupMembersSearchUsersResultsListItemUser = memo(
  function AddGroupMembersSearchUsersResultsListItemUser(props: { inboxId: IXmtpInboxId }) {
    const { inboxId } = props

    const { addSelectedInboxId } = useAddGroupMembersStore((state) => state.actions)
    const { xmtpConversationId } = useRouteParams<"AddGroupMembers">()

    const { data: isAlreadyAMember } = useQuery({
      ...getGroupQueryOptions({
        clientInboxId: getSafeCurrentSender().inboxId,
        xmtpConversationId,
        caller: "add-group-members",
      }),
      select: (group) => group?.members && group.members.byId[inboxId],
    })

    const handlePress = useCallback(() => {
      if (isAlreadyAMember) {
        return
      }

      addSelectedInboxId(inboxId)
    }, [addSelectedInboxId, inboxId, isAlreadyAMember])

    return (
      <SearchUsersResultsListItemUser
        inboxId={inboxId}
        onPress={handlePress}
        {...(isAlreadyAMember
          ? {
              endElement: (
                <Chip size="sm">
                  <ChipText>Already in the group</ChipText>
                </Chip>
              ),
            }
          : {})}
      />
    )
  },
)
