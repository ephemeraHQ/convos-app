import { useTurnkey } from "@turnkey/sdk-react-native"
import { IEthereumAddress } from "@/utils/evm/address"

export function useCurrentTurnkeySessionWalletAddress() {
  const { session } = useTurnkey()
  return session?.user?.wallets[0].accounts[0].address as IEthereumAddress
}
