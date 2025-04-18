import { SharedValue } from "react-native-reanimated"

/**
 * Props for the MediaViewer component
 */
export type IMediaViewerProps = {
  visible: boolean
  onClose: () => void
  uri: string
  sender?: string
  timestamp?: number
}

/**
 * Animation state used in the media viewer
 */
export type IAnimationState = {
  scale: SharedValue<number>
  savedScale: SharedValue<number>
  translateX: SharedValue<number>
  translateY: SharedValue<number>
  savedTranslateX: SharedValue<number>
  savedTranslateY: SharedValue<number>
  backgroundOpacity: SharedValue<number>
  controlsOpacity: SharedValue<number>
  transitionProgress: SharedValue<number>
  isAnimatingTransition: SharedValue<boolean>
  isDismissing: SharedValue<boolean>
  dismissAnimation: SharedValue<number>
}

/**
 * Props for the gesture handlers
 */
export type IGestureHandlerProps = {
  animState: IAnimationState
  toggleControls: () => void
  onDismiss: () => void
}
