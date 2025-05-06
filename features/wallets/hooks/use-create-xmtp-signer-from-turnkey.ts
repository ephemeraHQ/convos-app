import { useTurnkey } from "@turnkey/sdk-react-native"
import { createAccount } from "@turnkey/viem"
import { PublicIdentity } from "@xmtp/react-native-sdk"
import { useCallback } from "react"
import { createWalletClient, http } from "viem"
import { mainnet } from "viem/chains"
import { IXmtpSigner } from "@/features/xmtp/xmtp.types"

export function useCreateXmtpSignerFromTurnkey() {
  const { client: turnkeyClient, session } = useTurnkey()

  return useCallback((): IXmtpSigner => {
    if (!turnkeyClient) {
      throw new Error("Turnkey client not found while creating XMTP signer")
    }

    if (!session) {
      throw new Error("Session not found while creating XMTP signer")
    }

    const walletAddress = session.user?.wallets[0].accounts[0].address

    if (!walletAddress) {
      throw new Error("Wallet address not found while creating XMTP signer")
    }

    console.log("walletAddress:", walletAddress)
    console.log("session.user?.organizationId:", session.user?.organizationId)

    return {
      getIdentifier: async () => new PublicIdentity(walletAddress, "ETHEREUM"),
      getChainId: () => undefined,
      getBlockNumber: () => undefined,
      signerType: () => "EOA",
      signMessage: async (message: string) => {
        const viemAccount = await createAccount({
          client: turnkeyClient,
          organizationId: session.user?.organizationId!,
          signWith: walletAddress,
          ethereumAddress: walletAddress,
        })

        console.log("viemAccount.address:", viemAccount.address)

        const viemClient = createWalletClient({
          account: viemAccount,
          chain: mainnet,
          transport: http(),
        })

        console.log("viemClient.account:", viemClient.account)

        const signedMessage = await viemClient.signMessage({
          message: message,
        })

        return {
          signature: signedMessage,
        }
      },
    }
  }, [session, turnkeyClient])
}
