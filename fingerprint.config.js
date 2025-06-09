/** @type {import('@expo/fingerprint').Config} */
const config = {
  // Skip certain sources that don't affect native compatibility
  sourceSkips: [
    "ExpoConfigVersions", // Skip version changes (handled by our transition logic)
    "ExpoConfigNames", // Skip app name changes
    "ExpoConfigAssets", // Skip asset changes (icons, splash screens)
    "PackageJsonAndroidAndIosScriptsIfNotContainRun", // Skip script changes that don't contain "run"
    "GitIgnore", // Skip .gitignore changes
  ],

  // Limit concurrent I/O operations for better performance
  concurrentIoLimit: 10,

  // Use SHA-256 for better collision resistance
  hashAlgorithm: "sha256",

  // Additional paths to ignore beyond .fingerprintignore
  ignorePaths: [
    // Temporary files
    "**/*.tmp",
    "**/*.temp",

    // Log files
    "**/*.log",

    // IDE files
    ".vscode/**",
    ".idea/**",

    // OS files
    ".DS_Store",
    "Thumbs.db",

    // Build artifacts that don't affect fingerprint
    ".expo/**",
    "node_modules/**",

    // Documentation
    "**/*.md",
    "docs/**",

    // Test files
    "**/*.test.*",
    "**/__tests__/**",

    // GitHub workflows except our PR preview
    ".github/workflows/**",
    "!.github/workflows/pr-preview.yml",
  ],
}

module.exports = config
