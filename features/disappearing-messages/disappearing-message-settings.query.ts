import { useQuery } from "@tanstack/react-query"
import { IDisappearingMessageSettings } from "@/features/disappearing-messages/disappearing-messages.constants"
import { getXmtpDisappearingMessageSettings } from "@/features/xmtp/xmtp-disappearing-messages/xmtp-disappearing-messages"
import { IXmtpConversationId, IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { reactQueryClient } from "@/utils/react-query/react-query.client"
import {
  createQueryObserverWithPreviousData,
  IQueryObserverWithPreviousDataResult,
} from "@/utils/react-query/react-query.helpers"
import { getReactQueryKey } from "@/utils/react-query/react-query.utils"

type IArgs = {
  clientInboxId: IXmtpInboxId | undefined
  conversationId: IXmtpConversationId | undefined
  caller: string
}

export const getDisappearingMessageSettingsQueryOptions = (args: IArgs) => {
  const { clientInboxId, conversationId } = args

  return {
    queryKey: getReactQueryKey({
      baseStr: "xmtp-disappearing-message-settings",
      clientInboxId,
      conversationId,
    }),
    queryFn: () => {
      return getXmtpDisappearingMessageSettings({
        clientInboxId: clientInboxId!,
        conversationId: conversationId!,
      })
    },
    enabled: Boolean(clientInboxId && conversationId),
  }
}

export const useDisappearingMessageSettingsQuery = (args: IArgs) => {
  return useQuery(getDisappearingMessageSettingsQueryOptions(args))
}

export const invalidateDisappearingMessageSettings = (args: IArgs) => {
  return reactQueryClient.invalidateQueries(getDisappearingMessageSettingsQueryOptions(args))
}

export function refetchDisappearingMessageSettings(args: IArgs) {
  return reactQueryClient.refetchQueries(getDisappearingMessageSettingsQueryOptions(args))
}

export function listenForDisappearingMessageSettingsQueryChanges(
  args: IArgs & {
    onChanges: (
      result: IQueryObserverWithPreviousDataResult<IDisappearingMessageSettings, Error>,
    ) => void
  },
) {
  const { onChanges, ...restArgs } = args
  return createQueryObserverWithPreviousData({
    queryOptions: getDisappearingMessageSettingsQueryOptions(restArgs),
    observerCallbackFn: onChanges,
  })
}

export function ensureDisappearingMessageSettings(args: IArgs) {
  return reactQueryClient.ensureQueryData(getDisappearingMessageSettingsQueryOptions(args))
}
