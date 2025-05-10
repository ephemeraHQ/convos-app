import { Text } from "@design-system/Text"
import React, { memo, useCallback, useMemo } from "react"
import { StyleProp, ViewStyle } from "react-native"
import { EntryAnimationsValues, withSpring } from "react-native-reanimated"
import { HStack } from "@/design-system/HStack"
import { Icon } from "@/design-system/Icon/Icon"
import { StaggeredAnimation } from "@/design-system/staggered-animation"
import { TouchableOpacity } from "@/design-system/TouchableOpacity"
import { AnimatedVStack, VStack } from "@/design-system/VStack"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useCurrentXmtpConversationIdSafe } from "@/features/conversation/conversation-chat/conversation.store-context"
import { useMessageIsFromCurrentSenderInboxId } from "@/features/conversation/utils/message-is-from-current-user"
import { getReactionContent } from "@/features/xmtp/xmtp-codecs/xmtp-codecs-reaction"
import { IXmtpInboxId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"
import { favoritedEmojis } from "@/utils/emojis/favorited-emojis"
import { IConversationMessageReactionContent } from "../conversation-message.types"
import { MESSAGE_CONTEXT_MENU_ABOVE_MESSAGE_REACTIONS_HEIGHT } from "./conversation-message-context-menu.constants"

type IMessageContextMenuAboveMessageReactionsProps = {
  messageId: IXmtpMessageId
  onChooseMoreEmojis: () => void
  onSelectReaction: (emoji: string) => void
  originX: number
  originY: number
  reactors: {
    [reactor: IXmtpInboxId]: IConversationMessageReactionContent[]
  }
}

export const MessageContextMenuAboveMessageReactions = memo(
  function MessageContextMenuAboveMessageReactions(
    props: IMessageContextMenuAboveMessageReactionsProps,
  ) {
    const { messageId, onChooseMoreEmojis, onSelectReaction, originX, originY, reactors } = props
    const currentUserInboxId = useSafeCurrentSender().inboxId
    const xmtpConversationId = useCurrentXmtpConversationIdSafe()

    const { data: messageFromMe } = useMessageIsFromCurrentSenderInboxId({
      xmtpMessageId: messageId,
      xmtpConversationId,
    })

    const currentUserEmojiSelectedMap = useMemo(() => {
      if (!currentUserInboxId || !reactors?.[currentUserInboxId]) {
        return new Map<string, boolean>()
      }

      return new Map(
        reactors[currentUserInboxId].map((reaction) => [getReactionContent(reaction), true]),
      )
    }, [reactors, currentUserInboxId])

    return (
      <MessageContextMenuContainer originX={originX} originY={originY}>
        <ReactionsList
          emojis={favoritedEmojis.getEmojis()}
          messageFromMe={!!messageFromMe}
          currentUserEmojiSelectedMap={currentUserEmojiSelectedMap}
          onSelectReaction={onSelectReaction}
          onChooseMoreEmojis={onChooseMoreEmojis}
        />
      </MessageContextMenuContainer>
    )
  },
)

type IMessageContextMenuContainerProps = {
  children: React.ReactNode
  originX: number
  originY: number
  style?: StyleProp<ViewStyle>
}

const MessageContextMenuContainer = memo(function MessageContextMenuContainer(
  props: IMessageContextMenuContainerProps,
) {
  const { children, originX, originY, style } = props
  const { theme } = useAppTheme()

  const customEnteringAnimation = useCallback(
    (targetValues: EntryAnimationsValues) => {
      "worklet"

      const animations = {
        originX: withSpring(targetValues.targetOriginX, theme.animation.contextMenuSpring),
        originY: withSpring(targetValues.targetOriginY, theme.animation.contextMenuSpring),
        opacity: withSpring(1, theme.animation.contextMenuSpring),
        transform: [{ scale: withSpring(1, theme.animation.contextMenuSpring) }],
      }

      const initialValues = {
        originX:
          originX -
          // For the animation to look good. The real value should be the size of the box / 2 but this is close enough
          theme.layout.screen.width / 2,
        originY,
        opacity: 0,
        transform: [{ scale: 0 }],
      }

      return {
        initialValues,
        animations,
      }
    },
    [theme.animation.contextMenuSpring, originX, originY, theme.layout.screen.width],
  )

  return (
    <AnimatedVStack entering={customEnteringAnimation} style={[$container, style]}>
      {children}
    </AnimatedVStack>
  )
})

type IReactionsListProps = {
  emojis: string[]
  messageFromMe: boolean
  currentUserEmojiSelectedMap: Map<string, boolean>
  onSelectReaction: (emoji: string) => void
  onChooseMoreEmojis: () => void
}

const ReactionsList = memo(function ReactionsList(props: IReactionsListProps) {
  const {
    emojis,
    messageFromMe,
    currentUserEmojiSelectedMap,
    onSelectReaction,
    onChooseMoreEmojis,
  } = props
  const { theme } = useAppTheme()

  const handlePlusPress = useCallback(() => {
    onChooseMoreEmojis()
  }, [onChooseMoreEmojis])

  return (
    <HStack
      style={[
        $reactionsListContainer,
        {
          height: MESSAGE_CONTEXT_MENU_ABOVE_MESSAGE_REACTIONS_HEIGHT,
          borderRadius: theme.spacing.lg,
          paddingHorizontal: theme.spacing.xs,
          backgroundColor: theme.colors.background.raised,
        },
        messageFromMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
      ]}
    >
      {emojis.map((emoji, index) => (
        <StaggeredAnimation
          key={emoji}
          index={index}
          totalItems={emojis.length}
          isReverse={messageFromMe}
          delayBetweenItems={20}
        >
          <Emoji
            content={emoji}
            alreadySelected={!!currentUserEmojiSelectedMap.get(emoji)}
            onSelectReaction={onSelectReaction}
          />
        </StaggeredAnimation>
      ))}
      <PlusButton onPress={handlePlusPress} />
    </HStack>
  )
})

type IEmojiProps = {
  content: string
  alreadySelected: boolean
  onSelectReaction: (emoji: string) => void
}

const Emoji = memo(function Emoji(props: IEmojiProps) {
  const { content, alreadySelected, onSelectReaction } = props
  const { theme } = useAppTheme()

  const handlePress = useCallback(() => {
    onSelectReaction(content)
  }, [onSelectReaction, content])

  return (
    <TouchableOpacity onPress={handlePress}>
      <VStack
        style={[
          $emojiContainer,
          {
            height: theme.spacing.xxl,
            width: theme.spacing.xxl,
            marginRight: theme.spacing["4xs"],
            borderRadius: theme.spacing.sm,
          },
          alreadySelected && {
            backgroundColor: theme.colors.fill.minimal,
          },
        ]}
      >
        <Text preset="emojiSymbol">{content}</Text>
      </VStack>
    </TouchableOpacity>
  )
})

type IPlusButtonProps = {
  onPress: () => void
}

const PlusButton = memo(function PlusButton(props: IPlusButtonProps) {
  const { onPress } = props
  const { theme } = useAppTheme()

  return (
    <TouchableOpacity hitSlop={theme.spacing.xs} onPress={onPress}>
      <VStack
        style={[
          $plusButtonContainer,
          {
            height: theme.spacing.xxl,
            width: theme.spacing.xxl,
            borderRadius: theme.spacing.sm,
          },
        ]}
      >
        <Icon icon="plus" size={theme.iconSize.md} color={theme.colors.text.secondary} />
      </VStack>
    </TouchableOpacity>
  )
})

// Styles
const $container: ViewStyle = {
  flex: 1,
}

const $reactionsListContainer: ViewStyle = {
  justifyContent: "space-around",
  alignItems: "center",
}

const $emojiContainer: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
}

const $plusButtonContainer: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
}
