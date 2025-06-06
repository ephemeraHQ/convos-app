import { IXmtpClientWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { IEthereumAddress } from "@/utils/evm/address"
import { createPromiseCache } from "@/utils/promise-cache"
import { normalizeString } from "@/utils/str"

export const xmtpClientCache = createPromiseCache<IXmtpClientWithCodecs>({
  maxSize: 10,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
})

export function getEthAddressCacheKey(ethAddress: IEthereumAddress): string {
  return `eth:${normalizeString(ethAddress)}`
}

export function getInboxIdCacheKey(inboxId: IXmtpInboxId): string {
  return `inbox:${normalizeString(inboxId)}`
}

export function cacheClientUnderBothKeys(args: {
  client: IXmtpClientWithCodecs
  ethAddress: IEthereumAddress
}) {
  const { client, ethAddress } = args
  const clientPromise = Promise.resolve(client)

  xmtpClientCache.getOrCreate({
    key: getEthAddressCacheKey(ethAddress),
    fn: () => clientPromise,
  })

  xmtpClientCache.getOrCreate({
    key: getInboxIdCacheKey(client.inboxId),
    fn: () => clientPromise,
  })
}
