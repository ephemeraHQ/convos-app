module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce error handling for Promise-based function calls in React components and hooks",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      missingErrorHandling:
        "Promise-based function calls in React components and hooks must be wrapped in try-catch or use .catch()",
    },
  },
  create(context) {
    // Get the file extension
    const filename = context.getFilename()
    const isTsxFile = filename.endsWith(".tsx")

    // Track if we're inside a React component or hook
    let insideReactContext = false
    // Track if we're inside a try block
    let insideTryBlock = 0

    // Helper to check if a node is a React component
    function isReactComponent(node) {
      // Check for JSX in the function body
      const hasJSX =
        node.body &&
        (node.body.type === "JSXElement" ||
          (node.body.type === "BlockStatement" &&
            node.body.body.some(
              (n) =>
                n.type === "ReturnStatement" &&
                n.argument &&
                (n.argument.type === "JSXElement" || n.argument.type === "JSXFragment"),
            )))

      // Check for React hooks usage
      const hasHooks =
        node.body &&
        node.body.type === "BlockStatement" &&
        node.body.body.some(
          (n) =>
            n.type === "VariableDeclaration" &&
            n.declarations.some(
              (d) =>
                d.init &&
                d.init.type === "CallExpression" &&
                d.init.callee.name &&
                (d.init.callee.name.startsWith("use") || d.init.callee.name === "memo"),
            ),
        )

      return hasJSX || hasHooks
    }

    // Helper to check if we're inside a React hook callback
    function isInsideReactHook(node) {
      let current = node
      while (current) {
        if (
          current.type === "CallExpression" &&
          current.callee &&
          current.callee.name &&
          (current.callee.name.startsWith("use") ||
            current.callee.name === "useEffect" ||
            current.callee.name === "useCallback" ||
            current.callee.name === "useMemo" ||
            current.callee.name === "useLayoutEffect")
        ) {
          return true
        }
        current = current.parent
      }
      return false
    }

    return {
      // Only process .tsx files
      Program(node) {
        if (!isTsxFile) {
          return
        }
      },

      // Detect React component function declarations
      FunctionDeclaration(node) {
        if (isTsxFile && isReactComponent(node)) {
          insideReactContext = true
        }
      },
      // Detect React component arrow functions
      ArrowFunctionExpression(node) {
        if (isTsxFile && isReactComponent(node)) {
          insideReactContext = true
        }
      },
      // Detect memo wrapped components
      "CallExpression[callee.name='memo']"(node) {
        if (isTsxFile) {
          insideReactContext = true
        }
      },
      "FunctionDeclaration:exit"(node) {
        if (isTsxFile && isReactComponent(node)) {
          insideReactContext = false
        }
      },
      "ArrowFunctionExpression:exit"(node) {
        if (isTsxFile && isReactComponent(node)) {
          insideReactContext = false
        }
      },
      "CallExpression[callee.name='memo']:exit"(node) {
        if (isTsxFile) {
          insideReactContext = false
        }
      },
      // Track try blocks
      TryStatement(node) {
        insideTryBlock++
      },
      "TryStatement:exit"(node) {
        insideTryBlock--
      },
      // Check await expressions
      AwaitExpression(node) {
        if (!isTsxFile) {
          return
        }

        // Only check if we're inside a React component or React hook
        const shouldCheck = insideReactContext || isInsideReactHook(node)
        if (!shouldCheck) {
          return
        }

        // Skip if we're inside a try block
        if (insideTryBlock > 0) return

        // Check if the await expression is followed by a .catch()
        const parent = node.parent
        if (parent.type === "MemberExpression" && parent.property.name === "catch") {
          return
        }

        // Report error if no error handling is found
        context.report({
          node,
          messageId: "missingErrorHandling",
        })
      },
      // Check Promise.then() calls
      "CallExpression[callee.property.name='then']"(node) {
        if (!isTsxFile) {
          return
        }

        // Only check if we're inside a React component or React hook
        const shouldCheck = insideReactContext || isInsideReactHook(node)
        if (!shouldCheck) {
          return
        }

        // Skip if we're inside a try block
        if (insideTryBlock > 0) return

        // Check if .then() is followed by .catch()
        const parent = node.parent
        if (parent.type === "MemberExpression" && parent.property.name === "catch") {
          return
        }

        // Report error if no error handling is found
        context.report({
          node,
          messageId: "missingErrorHandling",
        })
      },
    }
  },
}
