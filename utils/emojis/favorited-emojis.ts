import { storage } from "../storage/storage"

const FAVORITED_EMOJIS_STORAGE_KEY = "favorited-emojis"

const DEFAULT_EMOJIS = ["❤️", "👍", "👎", "😂", "🤔", "😲"]
type IFavoritedEmojis = {
  emojis: string[]
  emojisSet: Set<string>
}

class FavoritedEmojis {
  private state: IFavoritedEmojis

  constructor() {
    const savedEmojis = storage.getString(FAVORITED_EMOJIS_STORAGE_KEY)
    const emojis = savedEmojis ? (JSON.parse(savedEmojis) as string[]) : DEFAULT_EMOJIS

    this.state = {
      emojis,
      emojisSet: new Set(emojis),
    }
  }

  getEmojis() {
    return this.state.emojis
  }

  pushEmoji(args: { emoji: string }) {
    const { emoji } = args

    if (!this.state.emojisSet.has(emoji)) {
      this.state.emojis.unshift(emoji)
      this.state.emojis.pop()
      this.state.emojisSet = new Set(this.state.emojis)

      storage.set(FAVORITED_EMOJIS_STORAGE_KEY, JSON.stringify(this.state.emojis))
    }
  }

  replaceEmoji(args: { emoji: string; index: number }) {
    const { emoji, index } = args

    if (!this.state.emojisSet.has(emoji)) {
      this.state.emojis[index] = emoji
      this.state.emojisSet = new Set(this.state.emojis)

      storage.set(FAVORITED_EMOJIS_STORAGE_KEY, JSON.stringify(this.state.emojis))
    }
  }

  isFavorite(args: { emoji: string }) {
    const { emoji } = args
    return this.state.emojisSet.has(emoji)
  }
}

export const favoritedEmojis = new FavoritedEmojis()
