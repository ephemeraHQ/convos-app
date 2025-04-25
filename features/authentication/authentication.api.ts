import { z } from "zod"
import { captureError } from "@/utils/capture-error"
import { ConvosApiError } from "@/utils/convos-api/convos-api-error"
import { convosApi, convosPublicApi } from "@/utils/convos-api/convos-api-instance"
import { AUTHENTICATE_ROUTE } from "./authentication.constants"

const fetchJwtResponseSchema = z.object({
  token: z.string(),
})

type FetchJwtResponse = z.infer<typeof fetchJwtResponseSchema>

export async function fetchJwt({ signal }: { signal?: AbortSignal }): Promise<FetchJwtResponse> {
  try {
    const response = await convosApi.post<FetchJwtResponse>(AUTHENTICATE_ROUTE, {
      signal,
    })
    return fetchJwtResponseSchema.parse(response.data)
  } catch (error) {
    throw new ConvosApiError({
      error,
      additionalMessage: "Failed to fetch JWT",
    })
  }
}

const createSubOrganizationResponseSchema = z.object({
  subOrgId: z.string(),
  walletAddress: z.string(),
})

type CreateSubOrganizationResponse = z.infer<typeof createSubOrganizationResponseSchema>

type AuthenticatorTransport =
  | "AUTHENTICATOR_TRANSPORT_BLE"
  | "AUTHENTICATOR_TRANSPORT_INTERNAL"
  | "AUTHENTICATOR_TRANSPORT_NFC"
  | "AUTHENTICATOR_TRANSPORT_USB"
  | "AUTHENTICATOR_TRANSPORT_HYBRID"

export async function createSubOrganization(args: {
  passkey: {
    challenge: string
    attestation: {
      credentialId: string
      clientDataJson: string
      attestationObject: string
      transports: AuthenticatorTransport[]
    }
  }
  signal?: AbortSignal
}) {
  try {
    const { passkey, signal } = args

    const response = await convosPublicApi.post<CreateSubOrganizationResponse>(
      "/api/v1/wallets",
      {
        challenge: passkey.challenge,
        attestation: passkey.attestation,
      },
      {
        signal,
      },
    )

    console.log("response:", response.data)

    const result = createSubOrganizationResponseSchema.safeParse(response.data)

    if (!result.success) {
      captureError(
        new ConvosApiError({
          error: result.error,
          additionalMessage: "Invalid response format when creating sub-organization",
        }),
      )
    }

    return response.data
  } catch (error) {
    throw new ConvosApiError({
      error,
      additionalMessage: "Failed to create sub-organization",
    })
  }
}
