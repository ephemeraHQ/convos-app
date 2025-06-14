import { translate } from "@i18n"
import React, { memo, useCallback, useMemo } from "react"
// import { useGroupPendingRequests } from "@/hooks/useGroupPendingRequests";
import { Avatar } from "@/components/avatar"
import { GroupAvatar } from "@/components/group-avatar"
import { IExtendedEdge } from "@/components/screen/screen.helpers"
import { IHeaderProps } from "@/design-system/Header/Header"
import { HStack } from "@/design-system/HStack"
import { Pressable } from "@/design-system/Pressable"
import { Text } from "@/design-system/Text"
import { VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationStoreContext } from "@/features/conversation/conversation-chat/conversation.store-context"
import { useConversationType } from "@/features/conversation/hooks/use-conversation-type"
import { useDmPeerInboxId } from "@/features/conversation/hooks/use-dm-peer-inbox-id"
import { DisappearingMessagesHeaderAction } from "@/features/disappearing-messages/disappearing-messages-header-action"
import { useCurrentSenderGroupMember } from "@/features/groups/hooks/use-current-sender-group-member"
import { useGroupMembers } from "@/features/groups/hooks/use-group-members"
import { useGroupName } from "@/features/groups/hooks/use-group-name"
import { useGroupPermissionsQuery } from "@/features/groups/queries/group-permissions.query"
import {
  getGroupMemberIsAdmin,
  getGroupMemberIsSuperAdmin,
} from "@/features/groups/utils/group-admin.utils"
import { usePreferredDisplayInfo } from "@/features/preferred-display-info/use-preferred-display-info"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useHeader } from "@/navigation/use-header"
import { useRouter } from "@/navigation/use-navigation"
import { useAppTheme } from "@/theme/use-app-theme"
import { copyToClipboard } from "@/utils/clipboard"

export function useConversationScreenHeader() {
  const navigation = useRouter()
  const currentSender = useSafeCurrentSender()
  const isCreatingNewConversation = useConversationStoreContext(
    (state) => state.isCreatingNewConversation,
  )
  const xmtpConversationId = useConversationStoreContext((state) => state.xmtpConversationId)
  const { data: conversationType } = useConversationType({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId: xmtpConversationId!,
    caller: "useConversationScreenHeader",
  })

  const { currentSenderGroupMember } = useCurrentSenderGroupMember({
    xmtpConversationId: xmtpConversationId!,
  })

  const { data: groupPermissions } = useGroupPermissionsQuery({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId: xmtpConversationId!,
    caller: "useConversationScreenHeader",
  })

  const canEditDisappearingMessages = useMemo(() => {
    if (conversationType === "dm") {
      return true
    }

    if (conversationType !== "group" || !groupPermissions || !currentSenderGroupMember) {
      return false
    }

    const policy = groupPermissions.updateMessageDisappearingPolicy

    if (policy === "allow") {
      return true
    }

    if (policy === "deny") {
      return false
    }

    if (policy === "admin") {
      return getGroupMemberIsAdmin({ member: currentSenderGroupMember })
    }

    if (policy === "superAdmin") {
      return getGroupMemberIsSuperAdmin({ member: currentSenderGroupMember })
    }

    return false
  }, [conversationType, groupPermissions, currentSenderGroupMember])

  const onBack = useCallback(() => navigation.goBack(), [navigation])

  const headerConfig = useMemo((): IHeaderProps => {
    const baseConfig: IHeaderProps = {
      onBack,
      safeAreaEdges: ["top" as IExtendedEdge],
    }

    if (isCreatingNewConversation) {
      return {
        ...baseConfig,
        title: "New chat",
        withBottomBorder: true,
      }
    }

    if (conversationType && xmtpConversationId) {
      if (conversationType === "dm") {
        return {
          ...baseConfig,
          titleComponent: <DmConversationTitle xmtpConversationId={xmtpConversationId} />,
          RightActionComponent: (
            <DisappearingMessagesHeaderAction xmtpConversationId={xmtpConversationId} />
          ),
        }
      }

      if (conversationType === "group") {
        return {
          ...baseConfig,
          titleComponent: <GroupConversationTitle xmtpConversationId={xmtpConversationId} />,
          RightActionComponent: canEditDisappearingMessages ? (
            <DisappearingMessagesHeaderAction xmtpConversationId={xmtpConversationId} />
          ) : undefined,
        }
      }
    }

    return baseConfig
  }, [
    conversationType,
    isCreatingNewConversation,
    onBack,
    xmtpConversationId,
    canEditDisappearingMessages,
  ])

  useHeader(headerConfig, [headerConfig])
}

type ConversationHeaderTitleDumbProps = {
  title?: string
  subtitle?: React.ReactNode
  avatarComponent?: React.ReactNode
  onLongPress?: () => void
  onPress?: () => void
}

const ConversationHeaderTitleDumb = memo(function ConversationHeaderTitle({
  avatarComponent,
  title,
  subtitle,
  onLongPress,
  onPress,
}: ConversationHeaderTitleDumbProps) {
  const { theme } = useAppTheme()

  return (
    <HStack
      style={{
        paddingHorizontal: theme.spacing.xxxs,
        flex: 1,
      }}
    >
      <Pressable
        onLongPress={onLongPress}
        onPress={onPress}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <HStack
          style={{
            paddingRight: theme.spacing.xxs,
          }}
        >
          {avatarComponent}
        </HStack>
        <VStack
          style={{
            flex: 1,
          }}
        >
          <Text numberOfLines={1} allowFontScaling={false}>
            {title}
          </Text>
          {subtitle}
        </VStack>
      </Pressable>
    </HStack>
  )
})

type GroupConversationTitleProps = {
  xmtpConversationId: IXmtpConversationId
}

const GroupConversationTitle = memo(function GroupConversationTitle({
  xmtpConversationId,
}: GroupConversationTitleProps) {
  const currentSender = useSafeCurrentSender()
  const router = useRouter()

  const { members } = useGroupMembers({
    caller: "GroupConversationTitle",
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
  })

  const { groupName, isLoading: groupNameLoading } = useGroupName({
    xmtpConversationId,
  })

  const onPress = useCallback(() => {
    router.navigate("GroupDetails", { xmtpConversationId })
  }, [router, xmtpConversationId])

  const subtitle = useMemo(() => {
    const requestsCount = 0 // TODO useGroupPendingRequests(conversationTopic).length;

    const memberText =
      members?.ids.length === 1
        ? translate("member_count", { count: members?.ids.length })
        : translate("members_count", { count: members?.ids.length })

    if (!members?.ids.length) {
      return null
    }

    return (
      <Text preset="formLabel">
        {memberText}
        {requestsCount > 0 && (
          <>
            {" • "}
            <Text preset="formLabel" color="action">
              {translate("pending_count", { count: requestsCount })}
            </Text>
          </>
        )}
      </Text>
    )
  }, [members?.ids.length])

  const AvatarComponent = useMemo(() => {
    return <GroupAvatar xmtpConversationId={xmtpConversationId} size="md" />
  }, [xmtpConversationId])

  if (groupNameLoading) {
    return null
  }

  return (
    <ConversationHeaderTitleDumb
      title={groupName ?? undefined}
      onPress={onPress}
      subtitle={subtitle}
      avatarComponent={AvatarComponent}
    />
  )
})

type DmConversationTitleProps = {
  xmtpConversationId: IXmtpConversationId
}

const DmConversationTitle = memo(function DmConversationTitle({
  xmtpConversationId,
}: DmConversationTitleProps) {
  const currentSender = useSafeCurrentSender()
  const navigation = useRouter()
  const { theme } = useAppTheme()

  const { data: peerInboxId } = useDmPeerInboxId({
    clientInboxId: currentSender.inboxId,
    xmtpConversationId,
    caller: "DmConversationTitle",
  })

  const { displayName, avatarUrl, isLoading } = usePreferredDisplayInfo({
    inboxId: peerInboxId,
    caller: "DmConversationTitle",
  })

  const onPress = useCallback(() => {
    if (peerInboxId) {
      navigation.push("Profile", { inboxId: peerInboxId })
    }
  }, [peerInboxId, navigation])

  const onLongPress = useCallback(() => {
    copyToClipboard(JSON.stringify(xmtpConversationId))
  }, [xmtpConversationId])

  if (isLoading) {
    return null
  }

  return (
    <ConversationHeaderTitleDumb
      title={displayName}
      onLongPress={onLongPress}
      onPress={onPress}
      avatarComponent={
        <Avatar uri={avatarUrl} sizeNumber={theme.avatarSize.md} name={displayName} />
      }
    />
  )
})
