import Clipboard from "@react-native-clipboard/clipboard"
import { showSnackbar } from "@/components/snackbar/snackbar.service"
import { IDropdownMenuCustomItemProps } from "@/design-system/dropdown-menu/dropdown-menu-custom"
import { useSafeCurrentSender } from "@/features/authentication/multi-inbox.store"
import { useConversationComposerStore } from "@/features/conversation/conversation-chat/conversation-composer/conversation-composer.store-context"
import { useConversationMessageContextMenuStore } from "@/features/conversation/conversation-chat/conversation-message/conversation-message-context-menu/conversation-message-context-menu.store-context"
import { useConversationMessageQuery } from "@/features/conversation/conversation-chat/conversation-message/conversation-message.query"
import {
  isRemoteAttachmentMessage,
  isStaticAttachmentMessage,
} from "@/features/conversation/conversation-chat/conversation-message/utils/conversation-message-assertions"
import { getMessageContentStringValue } from "@/features/conversation/conversation-list/hooks/use-message-content-string-value"
import { IXmtpConversationId, IXmtpMessageId } from "@/features/xmtp/xmtp.types"
import { translate } from "@/i18n"
import { captureErrorWithToast } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

export function useMessageContextMenuItems(args: {
  messageId: IXmtpMessageId
  xmtpConversationId: IXmtpConversationId
}) {
  const { messageId, xmtpConversationId } = args

  const currentSender = useSafeCurrentSender()
  const composerStore = useConversationComposerStore()
  const messageContextMenuStore = useConversationMessageContextMenuStore()

  const { data: message } = useConversationMessageQuery({
    xmtpMessageId: messageId,
    xmtpConversationId,
    clientInboxId: currentSender.inboxId,
    caller: "Conversation Message Context Menu",
  })

  if (!message) {
    captureErrorWithToast(
      new GenericError({
        error: new Error("No message found in triggerMessageContextMenu"),
        additionalMessage: "Couldn't find message",
      }),
      {
        message: "Couldn't find message",
      },
    )
    return []
  }

  const items: IDropdownMenuCustomItemProps[] = []

  items.push({
    label: translate("reply"),
    onPress: () => {
      composerStore.getState().setReplyToMessageId(messageId)
      messageContextMenuStore.getState().setMessageContextMenuData(null)
    },
    iconName: "arrowshape.turn.up.left",
  })

  const isAttachment = isRemoteAttachmentMessage(message) || isStaticAttachmentMessage(message)

  if (!isAttachment) {
    items.push({
      label: translate("copy"),
      iconName: "doc.on.doc",
      onPress: () => {
        const messageStringContent = getMessageContentStringValue({
          messageContent: message.content,
        })
        if (!!messageStringContent) {
          Clipboard.setString(messageStringContent)
        } else {
          showSnackbar({
            message: `Couldn't copy message content`,
          })
        }

        messageContextMenuStore.getState().setMessageContextMenuData(null)
      },
    })
  }

  // TODO: Implement share frame
  // if (frameURL) {
  //   items.push({
  //     title: translate("share"),
  //     rightView: <TableViewPicto symbol="square.and.arrow.up" />,
  //     id: CONTEXT_MENU_ACTIONS.SHARE_FRAME,
  //     action: () => {
  //       if (frameURL) {
  //         navigate("ShareFrame", { frameURL });
  //       }
  //       onContextClose();
  //     },
  //   });
  // }
  return items
}
