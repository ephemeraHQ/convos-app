import { MutationObserver, MutationOptions } from "@tanstack/react-query"
import {
  IDeviceIdentityId,
  unlinkIdentityFromDevice,
} from "@/features/convos-identities/convos-identities.api"
import { IDeviceId } from "@/features/devices/devices.types"
import { reactQueryClient } from "@/utils/react-query/react-query.client"

export type IUnlinkIdentityFromDeviceMutationArgs = {
  identityId: IDeviceIdentityId
  deviceId: IDeviceId
}

export function getUnlinkIdentityFromDeviceMutationOptions(): MutationOptions<
  void,
  Error,
  IUnlinkIdentityFromDeviceMutationArgs
> {
  return {
    mutationKey: ["unlinkIdentityFromDevice"],
    mutationFn: async (args: IUnlinkIdentityFromDeviceMutationArgs) => {
      return unlinkIdentityFromDevice(args)
    },
  }
}

export async function unlinkIdentityFromDeviceMutation(
  args: IUnlinkIdentityFromDeviceMutationArgs,
) {
  const unlinkIdentityFromDeviceMutationObserver = new MutationObserver(
    reactQueryClient,
    getUnlinkIdentityFromDeviceMutationOptions(),
  )
  return unlinkIdentityFromDeviceMutationObserver.mutate(args)
}
