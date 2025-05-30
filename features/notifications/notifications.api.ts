import { z } from "zod"
import { IXmtpConversationTopic, IXmtpInstallationId } from "@/features/xmtp/xmtp.types"
import { captureError } from "@/utils/capture-error"
import { convosApi } from "@/utils/convos-api/convos-api-instance"
import { ValidationError } from "@/utils/error"
import { IDeviceIdentityId } from "../convos-identities/convos-identities.api"

// Schema for registration request
const registrationRequestBodySchema = z.object({
  deviceId: z.string(),
  pushToken: z.string(),
  expoToken: z.string(),
  installations: z
    .array(
      z.object({
        identityId: z.custom<IDeviceIdentityId>(),
        xmtpInstallationId: z.custom<IXmtpInstallationId>(),
      }),
    )
    .default([]),
})

type IRegistrationRequestBody = z.infer<typeof registrationRequestBodySchema>

const registerInstallationResponseSchema = z.array(
  z.discriminatedUnion("status", [
    z.object({
      status: z.literal("success"),
      xmtpInstallationId: z.string(),
      validUntil: z.number(),
    }),
    z.object({
      status: z.literal("error"),
    }),
  ]),
)
type IRegisterInstallationResponse = z.infer<typeof registerInstallationResponseSchema>

/**
 * Registers a device installation for push notifications
 */
export const registerNotificationInstallation = async (args: IRegistrationRequestBody) => {
  try {
    const { data } = await convosApi.post<IRegisterInstallationResponse>(
      "/api/v1/notifications/register",
      args,
    )

    const result = registerInstallationResponseSchema.safeParse(data)
    if (!result.success) {
      captureError(
        new ValidationError({
          error: result.error,
          additionalMessage: "Failed to register notification installation in notifications.api.ts",
        }),
      )
    }

    return data
  } catch (error) {
    throw error
  }
}

/**
 * Unregisters a device installation
 */
export const unregisterNotificationInstallation = async (args: {
  installationId: IXmtpInstallationId
}) => {
  const { installationId } = args

  try {
    await convosApi.delete(`/api/v1/notifications/unregister/${installationId}`)
  } catch (error) {
    throw error
  }
}

const HmacKeySchema = z.object({
  thirtyDayPeriodsSinceEpoch: z.number(),
  key: z.string(),
})
export type IHmacKey = z.infer<typeof HmacKeySchema>

const SubscriptionSchema = z.object({
  topic: z.custom<IXmtpConversationTopic>(),
  isSilent: z.boolean().optional().default(false),
  hmacKeys: z.array(HmacKeySchema),
})

const SubscribeWithMetadataRequestSchema = z.object({
  installationId: z.string(),
  subscriptions: z.array(SubscriptionSchema),
})
type ISubscribeWithMetadataRequest = z.infer<typeof SubscribeWithMetadataRequestSchema>

/**
 * Subscribes an installation to notification topics with metadata
 */
export const subscribeToNotificationTopicsWithMetadata = async (
  args: ISubscribeWithMetadataRequest,
) => {
  try {
    await convosApi.post("/api/v1/notifications/subscribe", args)
  } catch (error) {
    throw error
  }
}

// Schema for unsubscribe request
const UnsubscribeRequestSchema = z.object({
  installationId: z.string(),
  topics: z.array(z.custom<IXmtpConversationTopic>()),
})
type IUnsubscribeRequest = z.infer<typeof UnsubscribeRequestSchema>

/**
 * Unsubscribes an installation from notification topics
 */
export const unsubscribeFromNotificationTopics = async (args: IUnsubscribeRequest) => {
  try {
    await convosApi.post("/api/v1/notifications/unsubscribe", args)
  } catch (error) {
    throw error
  }
}
