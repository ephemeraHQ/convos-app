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
