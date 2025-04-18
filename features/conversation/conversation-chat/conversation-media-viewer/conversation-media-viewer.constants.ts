export const CONVERSATION_MEDIA_VIEWER_CONSTANTS = {
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
