import { z } from "zod"
import { IXmtpInboxId, IXmtpInstallationId } from "@/features/xmtp/xmtp.types"
import { IEthereumAddress } from "@/utils/evm/address"
import { IDeviceIdentityId } from "../convos-identities/convos-identities.api"

export type IConvosUserID = string & { readonly __brand: unique symbol }

export type IConvosCurrentUser = z.infer<typeof currentUserSchema>

export const createUserIdentitySchema = z.object({
  id: z.custom<IDeviceIdentityId>(),
  turnkeyAddress: z.custom<IEthereumAddress>(),
  xmtpId: z.custom<IXmtpInboxId>(),
  xmtpInstallationId: z.custom<IXmtpInstallationId>(),
})

export const currentUserSchema = z.object({
  id: z.custom<IConvosUserID>(),
})
