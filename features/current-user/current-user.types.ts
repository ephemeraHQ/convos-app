import { z } from "zod"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { IEthereumAddress } from "@/utils/evm/address"

export type IConvosUserID = string & { readonly __brand: unique symbol }

export type IConvosCurrentUser = z.infer<typeof currentUserSchema>

export const identitySchema = z.object({
  id: z.string(),
  turnkeyAddress: z.custom<IEthereumAddress>(),
  xmtpId: z.custom<IXmtpInboxId>(),
})

export const currentUserSchema = z.object({
  id: z.custom<IConvosUserID>(),
  //   deviceId: deviceSchema.pick({
  //     id: true,
  //   }),
  identities: z.array(identitySchema),
})
