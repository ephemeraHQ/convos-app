import { config } from "@/config"
import { useMultiInboxStore } from "@/features/authentication/multi-inbox.store"

export function currentUserIsDebugUser() {
  const senders = useMultiInboxStore.getState().senders
  return senders.some((sender) => config.debugEthAddresses.includes(sender.ethereumAddress))
}
