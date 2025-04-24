import { useCallback, useMemo } from "react"
import { Alert } from "react-native"
import { HeaderAction } from "@/design-system/Header/HeaderAction"
import { HStack } from "@/design-system/HStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useCurrentSenderGroupMember } from "@/features/groups/hooks/use-current-sender-group-member"
import { useGroupPermissionsQuery } from "@/features/groups/queries/group-permissions.query"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"

export function useGroupDetailsScreenHeader(args: { xmtpConversationId: IXmtpConversationId }) {
  const { xmtpConversationId } = args

  const router = useRouter()
  const { theme } = useAppTheme()
  const currentSenderInboxId = useSafeCurrentSender().inboxId

  const { currentSenderGroupMember } = useCurrentSenderGroupMember({
    xmtpConversationId,
  })

  const { data: groupPermissions } = useGroupPermissionsQuery({
    clientInboxId: currentSenderInboxId,
    xmtpConversationId,
    caller: "GroupDetailsScreenHeader",
  })

  const canEditGroup = useMemo(() => {
    // Policies that would affect editing group details
    const editPolicies = [
      groupPermissions?.updateGroupNamePolicy,
      groupPermissions?.updateGroupDescriptionPolicy,
      groupPermissions?.updateGroupImagePolicy,
    ]

    // If all policies are "allow", anyone can edit
    if (editPolicies.every((policy) => policy === "allow")) {
      return true
    }

    if (!currentSenderGroupMember) {
      return false
    }

    // If any policy is "admin", check for admin permissions
    if (editPolicies.some((policy) => policy === "admin")) {
      return getGroupMemberIsAdmin({ member: currentSenderGroupMember })
    }

    // If any policy is "superAdmin", check for super_admin permission
    if (editPolicies.some((policy) => policy === "superAdmin")) {
      return getGroupMemberIsSuperAdmin({ member: currentSenderGroupMember })
    }

    return false
  }, [groupPermissions, currentSenderGroupMember])

  const handleBackPress = useCallback(() => {
    router.goBack()
  }, [router])

  const handleSharePress = useCallback(() => {
    // TODO: Implement share functionality
    Alert.alert("Share pressed")
  }, [])

  const handleEditPress = useCallback(() => {
    router.navigate("EditGroup", { xmtpConversationId })
  }, [router, xmtpConversationId])

  const handleMenuPress = useCallback(() => {
    // TODO: Implement menu functionality
    Alert.alert("Menu pressed")
  }, [])

  useHeader(
    {
      safeAreaEdges: ["top"],
      title: "Info",
      leftIcon: "chevron.left",
      onLeftPress: handleBackPress,
      backgroundColor: theme.colors.background.surface,
      RightActionComponent: (
        <HStack style={{ columnGap: theme.spacing["4xs"] }}>
          {/* <HeaderAction icon="square.and.arrow.up" onPress={handleSharePress} /> */}
          {canEditGroup && <HeaderAction icon="pencil" onPress={handleEditPress} />}
          {/* <HeaderAction icon="more_vert" onPress={handleMenuPress} /> */}
        </HStack>
      ),
    },
    [handleBackPress, handleSharePress, handleEditPress, handleMenuPress, theme, canEditGroup],
  )
}
