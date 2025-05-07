import { TurnkeySigner } from "@turnkey/ethers"
import { useTurnkey } from "@turnkey/sdk-react-native"
import { createAccount } from "@turnkey/viem"
import { PublicIdentity } from "@xmtp/react-native-sdk"
import { ethers } from "ethers"
import { useCallback } from "react"
import { createWalletClient, http } from "viem"
import { mainnet } from "viem/chains"
import { config } from "@/config"
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

        const viemClient = createWalletClient({
          account: viemAccount,
          chain: mainnet,
          transport: http(),
        })

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

export function useCreateXmtpSignerFromTurnkeyTwo() {
  const { session, signRawPayload } = useTurnkey()

  return useCallback((): IXmtpSigner => {
    if (!session) {
      throw new Error("Session not found while creating XMTP signer")
    }

    const walletAddress = session.user?.wallets[0].accounts[0].address

    if (!walletAddress) {
      throw new Error("Wallet address not found while creating XMTP signer")
    }

    return {
      getIdentifier: async () => new PublicIdentity(walletAddress, "ETHEREUM"),
      getChainId: () => undefined,
      getBlockNumber: () => undefined,
      signerType: () => "EOA",
      signMessage: async (message: string) => {
        const result = await signRawPayload({
          signWith: walletAddress,
          payload: message,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_SHA256",
        })

        return {
          signature: `0x${result.r}${result.s}${result.v}`,
        }
      },
    }
  }, [session, signRawPayload])
}

export function useCreateXmtpSignerFromTurnkeyThree() {
  const { session, client: turnkeyClient } = useTurnkey()

  return useCallback((): IXmtpSigner => {
    if (!session) {
      throw new Error("Session not found while creating XMTP signer")
    }

    const walletAddress = session.user?.wallets[0].accounts[0].address

    if (!walletAddress) {
      throw new Error("Wallet address not found while creating XMTP signer")
    }

    if (!turnkeyClient) {
      throw new Error("Turnkey client not found while creating XMTP signer")
    }

    const provider = new ethers.JsonRpcProvider(config.evm.rpcEndpoint)

    const turnkeySigner = new TurnkeySigner({
      client: turnkeyClient,
      organizationId: session.user?.organizationId!,
      signWith: walletAddress,
    })
    const connectedSigner = turnkeySigner.connect(provider)

    return {
      getIdentifier: async () => new PublicIdentity(walletAddress, "ETHEREUM"),
      getChainId: () => undefined,
      getBlockNumber: () => undefined,
      signerType: () => "EOA",
      signMessage: async (message: string) => {
        const result = await connectedSigner.signMessage(message)

        return {
          signature: result,
        }
      },
    }
  }, [session, turnkeyClient])
}
