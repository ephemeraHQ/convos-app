import { memo } from "react"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { HStack } from "@/design-system/HStack"
import { VStack } from "@/design-system/VStack"
import { Text } from "@/design-system/Text"
import { useGroupPermissions } from "@/features/groups/hooks/use-group-permissions.hook"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"

type MembersListHeaderProps = {
  xmtpConversationId: IXmtpConversationId
  memberCount: number
  onAddMember?: () => void
}

export const GroupDetailsMembersListHeader = memo(function GroupDetailsMembersListHeader(
  props: MembersListHeaderProps,
) {
  const { xmtpConversationId, memberCount, onAddMember } = props
  const { theme } = useAppTheme()
  
  const { canAddMembers } = useGroupPermissions({
    xmtpConversationId,
  })

  return (
    <VStack style={{ 
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xs
    }}>
      <HStack style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Text preset="small" color="secondary">
          {memberCount} {memberCount === 1 ? "MEMBER" : "MEMBERS"}
        </Text>
        {canAddMembers && onAddMember && (
          <HeaderAction
            icon="plus"
            onPress={onAddMember}
          />
        )}
      </HStack>
    </VStack>
  )
})
