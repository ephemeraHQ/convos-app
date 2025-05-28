import { Alert, AlertOptions } from "react-native"

/**
 * Creates an Alert with a text input that returns a Promise which resolves with
 * the input value when submitted, or undefined if canceled.
 */

export function promptAsync(args: {
  title: string
  message?: string
  type?: "plain-text" | "secure-text"
  defaultValue?: string
  submitText?: string
  cancelText?: string
  keyboardType?: string
  options?: AlertOptions
}) {
  const {
    title,
    message,
    type = "plain-text",
    defaultValue = "",
    submitText = "OK",
    cancelText = "Cancel",
    keyboardType,
    options,
  } = args

  return new Promise<{ value: string | undefined }>((resolve) => {
    Alert.prompt(
      title,
      message,
      [
        {
          text: cancelText,
          style: "cancel",
          onPress: () => resolve({ value: undefined }),
        },
        {
          text: submitText,
          style: "default",
          onPress: (value?: string) => resolve({ value }),
        },
      ],
      type,
      defaultValue,
      keyboardType,
      options,
    )
  })
}
