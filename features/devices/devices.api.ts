import { z } from "zod"
import { IConvosUserId } from "@/features/current-user/current-user.types"
import { deviceSchema, IDevice, IDeviceId } from "@/features/devices/devices.types"
import { captureError } from "@/utils/capture-error"
import { ConvosApiError } from "@/utils/convos-api/convos-api-error"
import { convosApi } from "@/utils/convos-api/convos-api-instance"
import { ValidationError } from "@/utils/error"

/**
 * Fetches a single device by ID
 */
export async function fetchDevice(args: { userId: string; deviceId: string }) {
  const { userId, deviceId } = args

  try {
    const { data } = await convosApi.get<IDevice>(`/api/v1/devices/${userId}/${deviceId}`)

    const result = deviceSchema.safeParse(data)
    if (!result.success) {
      captureError(new ValidationError({ error: result.error }))
    }

    return data
  } catch (error) {
    throw new ConvosApiError({ error })
  }
}

/**
 * Fetches all devices for a user
 */
export async function fetchUserDevices(args: { userId: string }) {
  const { userId } = args

  try {
    const { data } = await convosApi.get<IDevice[]>(`/api/v1/devices/${userId}`)

    const result = z.array(deviceSchema).safeParse(data)
    if (!result.success) {
      captureError(new ValidationError({ error: result.error }))
    }

    return data
  } catch (error) {
    throw new ConvosApiError({ error })
  }
}

/**
 * Creates a new device
 */

const deviceCreateInputSchema = deviceSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
})

export type IDeviceCreateInput = z.infer<typeof deviceCreateInputSchema>

export async function createDevice(args: { userId: string; device: IDeviceCreateInput }) {
  const { userId, device } = args

  try {
    // Validate the input data
    const validatedData = deviceCreateInputSchema.parse(device)

    const { data } = await convosApi.post<IDevice>(`/api/v1/devices/${userId}`, validatedData)

    const result = deviceSchema.safeParse(data)
    if (!result.success) {
      captureError(new ValidationError({ error: result.error }))
    }

    return data
  } catch (error) {
    throw new ConvosApiError({ error })
  }
}

/**
 * Updates an existing device
 */

const deviceUpdateInputSchema = deviceSchema.partial().omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
})

type IDeviceUpdateInput = z.infer<typeof deviceUpdateInputSchema>

export async function updateDevice(args: {
  userId: IConvosUserId
  deviceId: IDeviceId
  updates: IDeviceUpdateInput
}) {
  const { userId, deviceId, updates } = args

  try {
    const validatedData = deviceUpdateInputSchema.parse(updates)

    const { data } = await convosApi.put<IDevice>(
      `/api/v1/devices/${userId}/${deviceId}`,
      validatedData,
    )

    const result = deviceSchema.safeParse(data)
    if (!result.success) {
      captureError(new ValidationError({ error: result.error }))
    }

    return data
  } catch (error) {
    throw new ConvosApiError({ error })
  }
}
