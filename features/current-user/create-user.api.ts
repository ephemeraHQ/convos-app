import { z } from "zod"
import { ITurnkeyUserId } from "@/features/authentication/authentication.types"
import { IConvosUserID, identitySchema } from "@/features/current-user/current-user.types"
import { deviceSchema } from "@/features/devices/devices.types"
import { getDeviceModelId, getDeviceOs } from "@/features/devices/devices.utils"
import { ConvosProfileSchema, IConvosProfile } from "@/features/profiles/profiles.types"
import { IXmtpInboxId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { ConvosApiError } from "@/utils/convos-api/convos-api-error"
import { convosApi } from "@/utils/convos-api/convos-api-instance"
import { IEthereumAddress } from "@/utils/evm/address"

const createUserApiRequestBodySchema = z
  .object({
    turnkeyUserId: z.string(),
    device: deviceSchema.pick({
      os: true,
      name: true,
    }),
    identity: identitySchema.pick({
      turnkeyAddress: true,
      xmtpId: true,
    }),
    profile: ConvosProfileSchema.pick({
      name: true,
      username: true,
      avatar: true,
      description: true,
    }),
  })
  .strict()

export type ICreateUserApiRequestBody = z.infer<typeof createUserApiRequestBodySchema>

const createUserApiResponseSchema = z.object({
  id: z.custom<IConvosUserID>(),
  turnkeyUserId: z.custom<ITurnkeyUserId>(),
  device: deviceSchema.pick({
    id: true,
    os: true,
    name: true,
  }),
  identity: identitySchema.pick({
    id: true,
    turnkeyAddress: true,
    xmtpId: true,
  }),
  profile: ConvosProfileSchema.pick({
    id: true,
    name: true,
    username: true,
    avatar: true,
    description: true,
  }),
})

type CreateUserResponse = z.infer<typeof createUserApiResponseSchema>

export type ICreateUserArgs = {
  inboxId: IXmtpInboxId
  turnkeyUserId: ITurnkeyUserId
  smartContractWalletAddress: IEthereumAddress
  profile: Pick<IConvosProfile, "name" | "username" | "avatar" | "description">
}

export async function createUser(args: ICreateUserArgs) {
  const { turnkeyUserId, smartContractWalletAddress, inboxId, profile } = args

  try {
    const requestPayload = {
      turnkeyUserId,
      device: {
        os: getDeviceOs(),
        name: getDeviceModelId(),
      },
      identity: {
        turnkeyAddress: smartContractWalletAddress,
        xmtpId: inboxId,
      },
      profile,
    } satisfies ICreateUserApiRequestBody

    createUserApiRequestBodySchema.parse(requestPayload)

    const apiResponse = await convosApi.post<CreateUserResponse>("/api/v1/users", requestPayload)

    const responseValidation = createUserApiResponseSchema.safeParse(apiResponse.data)

    if (!responseValidation.success) {
      captureError(
        new ConvosApiError({
          error: responseValidation.error,
          additionalMessage: "Invalid create user response data",
        }),
      )
    }

    return apiResponse.data
  } catch (error) {
    throw new ConvosApiError({
      error,
      additionalMessage: "Failed to create user",
    })
  }
}
