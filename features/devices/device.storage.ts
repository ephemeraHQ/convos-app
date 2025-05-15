import { IDeviceId } from "@/features/devices/devices.types"
import { StorageError } from "@/utils/error"
import { deviceIdStorage } from "@/utils/storage/storages"
import { IConvosUserID } from "../current-user/current-user.types"

const DEVICE_ID_KEY = "convos-device-id"

function getDeviceIdKey(userId: IConvosUserID) {
  return `${DEVICE_ID_KEY}-${userId}`
}

export async function getStoredDeviceId(args: { userId: IConvosUserID }) {
  const { userId } = args

  try {
    return (await deviceIdStorage.getItem(getDeviceIdKey(userId))) as IDeviceId | null
  } catch (error) {
    throw new StorageError({
      error,
      additionalMessage: "Failed to get stored device ID",
    })
  }
}

export async function storeDeviceId(args: { userId: IConvosUserID; deviceId: IDeviceId }) {
  const { userId, deviceId } = args

  try {
    await deviceIdStorage.setItem(getDeviceIdKey(userId), deviceId)
  } catch (error) {
    throw new StorageError({
      error,
      additionalMessage: "Failed to store device ID",
    })
  }
}

export async function removeStoredDeviceId(args: { userId: IConvosUserID }) {
  const { userId } = args

  try {
    await deviceIdStorage.deleteItem(getDeviceIdKey(userId))
  } catch (error) {
    throw new StorageError({
      error,
      additionalMessage: "Failed to remove stored device ID",
    })
  }
}
