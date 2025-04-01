import { Trie } from "../trie"
import { IEmoji } from "./emoji.types"
import { emojis } from "./emojis.data"

export const emojiTrie = new Trie<IEmoji>()

// Build the trie by inserting each emoji's keywords
emojis.forEach((emojiSections) => {
  emojiSections.data.forEach((emoji) => {
    // For each emoji, insert all its keywords into the trie
    // This allows searching emojis by any of their associated keywords
    emoji.keywords.forEach((keyword) => {
      emojiTrie.insert(keyword, emoji)
    })
  })
})
