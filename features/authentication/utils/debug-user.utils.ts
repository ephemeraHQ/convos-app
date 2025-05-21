import { config } from "@/config"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"
import { isSameTrimmedAndNormalizedString } from "@/utils/str"

export function currentUserIsDebugUser() {
  const senders = useMultiInboxStore.getState().senders
  return senders.some((sender) =>
    config.debugEthAddresses.some((debugAddress) =>
      isSameTrimmedAndNormalizedString(sender.ethereumAddress, debugAddress),
    ),
  )
}
