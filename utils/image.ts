import { Image } from "expo-image"

export function prefetchImageUrl(imageUrl: string) {
  return Image.prefetch(imageUrl)
}

export async function clearImageCache() {
  await Image.clearDiskCache()
  await Image.clearMemoryCache()
}
