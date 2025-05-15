import * as Device from "expo-device"
import { Platform } from "react-native"
import { IDeviceOS } from "@/features/devices/devices.types"

export function getDeviceName() {
  return Device.modelId // ModelId is the name of the device
}

export function getDeviceOs() {
  return Platform.OS.toLowerCase() as IDeviceOS
}
