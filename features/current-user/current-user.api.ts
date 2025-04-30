import { currentUserSchema, IConvosCurrentUser } from "@/features/current-user/current-user.types"
import { captureError } from "@/utils/capture-error"
import { convosApi } from "@/utils/convos-api/convos-api-instance"
import { ValidationError } from "@/utils/error"

export async function fetchCurrentUser() {
  // Trying to get the device id for this specific device
  // If we didn't store the device id or can't get it, it will return the current user with all identities for now
  // const { data: deviceId, error: getStoredDeviceIdError } = await tryCatch(
  //   getStoredDeviceId({ turnkeyUserId }),
  // )

  // if (getStoredDeviceIdError) {
  //   captureError(getStoredDeviceIdError)
  // }

  // const { data } = await convosApi.get<IConvosCurrentUser>(
  //   deviceId ? `/api/v1/users/me?device_id=${deviceId}` : "/api/v1/users/me",
  // )

  const { data } = await convosApi.get<IConvosCurrentUser>("/api/v1/users/me")

  const parseResult = currentUserSchema.safeParse(data)

  if (!parseResult.success) {
    captureError(
      new ValidationError({
        error: parseResult.error,
      }),
    )
  }

  return data
}
