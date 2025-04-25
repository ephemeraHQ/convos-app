import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller"
import { useDerivedValue, useSharedValue } from "react-native-reanimated"

export function useAnimatedKeyboard() {
  const { height, progress: progressAV } = useReanimatedKeyboardAnimation()

  const previousOpenKeyboardHeightAV = useSharedValue(0)

  // Because when it's open it's like -346
  const keyboardHeightAV = useDerivedValue(() => {
    const currentHeight = height.value * -1

    // Store previous height when keyboard is fully open
    if (progressAV.value === 1 && currentHeight > 0) {
      // We saw some glitches where the height goes smaller than what it's actually is!
      // So we clamp it to the actual height.
      previousOpenKeyboardHeightAV.value = Math.max(
        previousOpenKeyboardHeightAV.value,
        currentHeight,
      )
    }

    return currentHeight
  })

  const keyboardIsShownAV = useDerivedValue(() => progressAV.value === 1)

  return {
    keyboardHeightAV,
    progressAV,
    keyboardIsShownAV,
    previousOpenKeyboardHeightAV,
  }
}
