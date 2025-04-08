import { IXmtpMessageId } from "@/features/xmtp/xmtp.types"

const optimisticMessageToRealMap = new Map<IXmtpMessageId, IXmtpMessageId>()

export function getRealMessageIdForOptimisticMessageId(optimisticMessageId: IXmtpMessageId) {
  return optimisticMessageToRealMap.get(optimisticMessageId)
}

export function setRealMessageIdForOptimisticMessageId(
  optimisticMessageId: IXmtpMessageId,
  realMessageId: IXmtpMessageId,
) {
  optimisticMessageToRealMap.set(optimisticMessageId, realMessageId)
}
