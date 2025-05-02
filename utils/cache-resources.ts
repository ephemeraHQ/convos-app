import { Asset } from "expo-asset"
import * as Font from "expo-font"
import { useCallback, useEffect } from "react"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"

// Define the assets to cache
const imagesToCache = [
  // Splash screens
  require("@assets/splash-icon-light.png"),
  require("@assets/splash-icon-dark.png"),

  // Icons
  require("@assets/icon-light.png"),
  require("@assets/icon-dark.png"),
  require("@assets/icon-tinted.png"),
  require("@assets/adaptive-icon.png"),

  // Web3 images
  require("@assets/images/web3/base.png"),
  require("@assets/images/web3/ens.png"),
  require("@assets/images/web3/farcaster.png"),
  require("@assets/images/web3/coinbase-wallet.png"),
  require("@assets/images/web3/lens.png"),
  require("@assets/images/web3/rainbow.png"),
  require("@assets/images/web3/unstoppable-domains.png"),
  require("@assets/images/web3/metamask.png"),
]

// Define fonts to preload
const fontsToCache = {
  // Add your fonts here
  // Example:
  // "inter-regular": require("@assets/fonts/Inter-Regular.ttf"),
  // "inter-bold": require("@assets/fonts/Inter-Bold.ttf"),
}

/**
 * Caches resources needed for the app to function properly
 * @returns An object with the loading state and a function to manually trigger caching
 */
export function useCachedResources() {
  const loadResourcesAsync = useCallback(async () => {
    try {
      // Pre-load fonts
      const fontPromises =
        Object.entries(fontsToCache).length > 0 ? [Font.loadAsync(fontsToCache)] : []

      // Pre-load images
      const imagePromises = imagesToCache.map((image) => Asset.fromModule(image).downloadAsync())

      // Wait for all resources to load
      await Promise.all([...fontPromises, ...imagePromises])
    } catch (error) {
      // Log any errors but don't crash the app
      captureError(new GenericError({ error, additionalMessage: "Error loading resources" }))
    }
  }, [])

  useEffect(() => {
    loadResourcesAsync()
  }, [loadResourcesAsync])
}
