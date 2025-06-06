import { FlashList, FlashListProps } from "@shopify/flash-list"
import { memo, useCallback, useMemo, useRef } from "react"
import { NativeScrollEvent, NativeSyntheticEvent, Platform } from "react-native"
import { useHeaderHeight } from "@/design-system/Header/Header.utils"
import { IXmtpConversationId } from "@/features/xmtp/xmtp.types"
import { useAppTheme } from "@/theme/use-app-theme"
import { useConversationListItemStyle } from "./conversation-list-item/conversation-list-item.styles"

type IConversationListProps = Omit<FlashListProps<IXmtpConversationId>, "data" | "renderItem"> & {
  conversationsIds: IXmtpConversationId[]
  renderConversation: FlashListProps<IXmtpConversationId>["renderItem"]
  onRefetch?: () => Promise<void>
}

export const ConversationList = memo(function ConversationList(props: IConversationListProps) {
  const { conversationsIds, renderConversation, onRefetch, ...rest } = props

  const { theme } = useAppTheme()
  const headerHeight = useHeaderHeight()
  const { listItemHeight } = useConversationListItemStyle()

  const { onScroll } = useRefreshHandler({
    onRefetch,
  })

  const estimatedItemListSize = useMemo(() => {
    return {
      height: theme.layout.screen.height - headerHeight,
      width: theme.layout.screen.width,
    }
  }, [theme.layout.screen.height, theme.layout.screen.width, headerHeight])

  return (
    <FlashList
      onScroll={onScroll}
      data={conversationsIds}
      keyExtractor={keyExtractor}
      estimatedItemSize={listItemHeight}
      estimatedListSize={estimatedItemListSize}
      renderItem={renderConversation}
      {...rest}
    />
  )
})

function keyExtractor(id: IXmtpConversationId) {
  return id
}

function useRefreshHandler(args: { onRefetch?: () => Promise<void> }) {
  const { onRefetch } = args

  const isRefetchingRef = useRef(false)

  const handleRefresh = useCallback(async () => {
    if (isRefetchingRef.current) return
    isRefetchingRef.current = true
    try {
      await onRefetch?.()
    } catch (error) {
      throw error
    } finally {
      isRefetchingRef.current = false
    }
  }, [onRefetch])

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isRefetchingRef.current) return
      const threshold = Platform.OS === "ios" ? -190 : 0
      const isAboveThreshold = e.nativeEvent.contentOffset.y < threshold
      if (isAboveThreshold) {
        handleRefresh()
      }
    },
    [handleRefresh],
  )

  return {
    onScroll,
    handleRefresh,
  }
}
