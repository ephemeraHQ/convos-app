import { useTurnkey } from "@turnkey/sdk-react-native"
import { PublicIdentity } from "@xmtp/react-native-sdk"
import { useCallback } from "react"
import { IEthereumAddress } from "@/utils/evm/address"

export function useCreateXmtpSignerFromTurnkey() {
  const { signRawPayload } = useTurnkey()

  return useCallback(
    (args: { walletAddress: IEthereumAddress }) => {
      const { walletAddress } = args

      return {
        getIdentifier: async () => new PublicIdentity(walletAddress, "ETHEREUM"),
        getChainId: () => undefined,
        getBlockNumber: () => undefined,
        signerType: () => "EOA",
        signMessage: async (message: string) => {
          const sig = await signRawPayload({
            signWith: walletAddress,
            payload: message,
            encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
            hashFunction: "HASH_FUNCTION_KECCAK256",
          })

          const signature = `0x${sig.r}${sig.s}${sig.v}`

          return { signature }
        },
      }
    },
    [signRawPayload],
  )
}
