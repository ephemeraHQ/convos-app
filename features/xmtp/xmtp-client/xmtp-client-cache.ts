import { IXmtpClientWithCodecs, IXmtpInboxId } from "@features/xmtp/xmtp.types"
import { IEthereumAddress } from "@/utils/evm/address"

// Cache clients by Ethereum address and by inbox ID
export const clientByEthAddress = new Map<IEthereumAddress, Promise<IXmtpClientWithCodecs>>()
export const clientByInboxId = new Map<IXmtpInboxId, Promise<IXmtpClientWithCodecs>>()
