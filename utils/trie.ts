/**
 * Trie data structure implementation for efficient string search operations.
 * Used for fast prefix-based lookups like emoji search by keywords.
 * Provides O(m) lookup time where m is the length of the search string.
 */

export class TrieNode<T> {
  children: Map<string, TrieNode<T>>
  isEndOfWord: boolean
  value: T | null

  constructor() {
    this.children = new Map()
    this.isEndOfWord = false
    this.value = null
  }
}

export class Trie<T> {
  private root: TrieNode<T>

  constructor() {
    this.root = new TrieNode<T>()
  }

  /**
   * Inserts a word into the trie and associates it with a value.
   *
   * Example:
   * ```
   * const trie = new Trie<string>();
   * trie.insert("hello", "greeting");
   * // Trie now contains the word "hello" with value "greeting"
   * ```
   *
   * Time Complexity: O(m) where m is word length
   */
  insert(word: string, value: T): void {
    let current = this.root

    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode<T>())
      }
      current = current.children.get(char)!
    }

    current.isEndOfWord = true
    current.value = value
  }

  /**
   * Searches for an exact word match in the trie and returns its associated value.
   * Returns null if the word is not found.
   *
   * Example:
   * ```
   * const trie = new Trie<string>();
   * trie.insert("hello", "greeting");
   *
   * trie.search("hello"); // Returns "greeting"
   * trie.search("hell");  // Returns null (not a complete word)
   * trie.search("world"); // Returns null (not in trie)
   * ```
   *
   * Time Complexity: O(m) where m is word length
   */
  search(rawWord: string): T | null {
    const word = rawWord.toLowerCase().trim()
    let current = this.root

    for (const char of word) {
      if (!current.children.has(char)) {
        return null
      }
      current = current.children.get(char)!
    }

    return current.isEndOfWord ? current.value : null
  }

  /**
   * Checks if any word in the trie starts with the given prefix.
   *
   * Example:
   * ```
   * const trie = new Trie<string>();
   * trie.insert("hello", "greeting");
   *
   * trie.startsWith("hel");  // Returns true
   * trie.startsWith("hell"); // Returns true
   * trie.startsWith("world"); // Returns false
   * ```
   *
   * Time Complexity: O(m) where m is prefix length
   */
  startsWith(prefix: string): boolean {
    let current = this.root

    for (const char of prefix) {
      if (!current.children.has(char)) {
        return false
      }
      current = current.children.get(char)!
    }

    return true
  }

  /**
   * Returns all values associated with words that begin with the given prefix.
   *
   * Example:
   * ```
   * const trie = new Trie<{name: string}>();
   * trie.insert("hello", {name: "greeting"});
   * trie.insert("help", {name: "assistance"});
   * trie.insert("world", {name: "planet"});
   *
   * trie.findAllWithPrefix("hel");
   * // Returns [{name: "greeting"}, {name: "assistance"}]
   *
   * trie.findAllWithPrefix("w");
   * // Returns [{name: "planet"}]
   *
   * trie.findAllWithPrefix("x");
   * // Returns [] (empty array)
   * ```
   *
   * NOTE: This only finds words that START WITH the prefix, not words
   * that contain the prefix elsewhere. This is why searching for "100"
   * won't find a keyword like "score100" or where "100" appears in the middle.
   *
   * Time Complexity: O(m + k) where m is prefix length and k is the
   * number of nodes in the subtree under the prefix
   */
  findAllWithPrefix(rawPrefix: string): T[] {
    const prefix = rawPrefix.toLowerCase().trim()
    const results: T[] = []
    let current = this.root

    // Navigate to the node representing the prefix
    for (const char of prefix) {
      if (!current.children.has(char)) {
        return results
      }
      current = current.children.get(char)!
    }

    // Collect all values under this node
    this.collectValues(current, results)
    return results
  }

  /**
   * Returns all values associated with words that contain the given text anywhere.
   * Unlike findAllWithPrefix, this searches for the text in any position.
   *
   * Example:
   * ```
   * const trie = new Trie<IEmoji>();
   * trie.insert("fire", {emoji: "🔥", keywords: ["fire", "hot", "flame"]});
   * trie.insert("hundred", {emoji: "💯", keywords: ["hundred_points", "score", "100"]});
   *
   * trie.findAllContaining("100");
   * // Returns the 💯 emoji object because "100" is in its keywords
   * ```
   *
   * This method is particularly useful for emoji search where you want to find
   * emojis that have a keyword containing the search term anywhere, not just at the start.
   *
   * Time Complexity: O(n) where n is the total number of nodes in the trie
   */
  findAllContaining(rawText: string): T[] {
    const text = rawText.toLowerCase().trim()
    const results: T[] = []

    // Helper function to traverse the entire trie
    const traverse = (node: TrieNode<T>) => {
      // If this node represents the end of a word, check if its value contains the search text
      if (node.isEndOfWord && node.value !== null) {
        // This assumes the value has a 'keywords' property that is an array of strings
        // Adjust as needed for your data structure
        const value = node.value as any
        if (value.keywords && Array.isArray(value.keywords)) {
          if (value.keywords.some((keyword: string) => keyword.toLowerCase().includes(text))) {
            results.push(node.value)
          }
        }
      }

      // Continue traversing all child nodes
      for (const childNode of node.children.values()) {
        traverse(childNode)
      }
    }

    // Start traversal from the root
    traverse(this.root)
    return results
  }

  /**
   * Helper method to recursively collect all values in a subtree.
   * Used by findAllWithPrefix to gather all matches.
   */
  private collectValues(node: TrieNode<T>, results: T[]): void {
    if (node.isEndOfWord && node.value !== null) {
      results.push(node.value)
    }

    for (const child of node.children.values()) {
      this.collectValues(child, results)
    }
  }

  /**
   * Removes a word from the trie.
   * Returns true if the word was found and deleted, false otherwise.
   *
   * Example:
   * ```
   * const trie = new Trie<string>();
   * trie.insert("hello", "greeting");
   * trie.insert("help", "assistance");
   *
   * trie.delete("hello"); // Returns true
   * trie.search("hello"); // Returns null (word was deleted)
   * trie.search("help");  // Returns "assistance" (still in trie)
   *
   * trie.delete("world"); // Returns false (word not in trie)
   * ```
   *
   * Time Complexity: O(m) where m is word length
   */
  delete(word: string): boolean {
    return this.deleteRecursive(this.root, word, 0)
  }

  /**
   * Helper method for delete function.
   * Recursively removes a word, cleaning up nodes that are no longer needed.
   */
  private deleteRecursive(current: TrieNode<T>, word: string, index: number): boolean {
    if (index === word.length) {
      if (!current.isEndOfWord) {
        return false
      }
      current.isEndOfWord = false
      current.value = null
      return current.children.size === 0
    }

    const char = word[index]
    if (!current.children.has(char)) {
      return false
    }

    const shouldDeleteChild = this.deleteRecursive(current.children.get(char)!, word, index + 1)

    if (shouldDeleteChild) {
      current.children.delete(char)
      return current.children.size === 0 && !current.isEndOfWord
    }

    return false
  }
}
