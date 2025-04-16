import { SharedValue } from 'react-native-reanimated'

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
 * Constants for animations
 */
export const VIEWER_CONSTANTS = {
  MAX_SCALE: 4,
  MIN_SCALE_THRESHOLD: 0.1,
  CLOSING_THRESHOLD: 0.5,
  DISMISS_THRESHOLD: 120, // Distance to dismiss in pixels
  TRANSITION_DURATION: 220,
  SPRING_CONFIG: {
    damping: 15,
    mass: 1,
    stiffness: 180,
    overshootClamping: true,
  },
}

/**
 * Props for the gesture handlers
 */
export type IGestureHandlerProps = {
  animState: IAnimationState
  toggleControls: () => void
  onDismiss: () => void
}
