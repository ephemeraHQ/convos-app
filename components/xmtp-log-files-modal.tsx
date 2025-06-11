import { Client } from "@xmtp/react-native-sdk"
import { useCallback, useEffect, useState } from "react"
import { Alert, FlatList, Modal, StyleSheet, TouchableOpacity, View } from "react-native"
import { create } from "zustand"
import { Center } from "@/design-system/Center"
import { HStack } from "@/design-system/HStack"
import { Loader } from "@/design-system/loader"
import { Text } from "@/design-system/Text"
import { getXmtpFilePaths } from "@/features/xmtp/xmtp-logs"
import { useAppTheme } from "@/theme/use-app-theme"
import { captureError } from "@/utils/capture-error"
import { GenericError } from "@/utils/error"
import { shareContent } from "@/utils/share"

type IXmtpLogFilesModalState = {
  visible: boolean
}

type IXmtpLogFilesModalActions = {
  setVisible: (visible: boolean) => void
}

type IXmtpLogFilesModalStore = IXmtpLogFilesModalState & {
  actions: IXmtpLogFilesModalActions
}

const initialState: IXmtpLogFilesModalState = {
  visible: false,
}

export const useXmtpLogFilesModalStore = create<IXmtpLogFilesModalStore>((set, get) => ({
  ...initialState,
  actions: {
    setVisible: (visible: boolean) => set({ visible }),
  },
}))

export function XmtpLogFilesModal() {
  const { theme } = useAppTheme()
  const visible = useXmtpLogFilesModalStore((state) => state.visible)

  const [logFiles, setLogFiles] = useState<string[]>([])
  const [fileSizes, setFileSizes] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [logStatus, setLogStatus] = useState<string>("")

  // Fetch log files when modal becomes visible
  useEffect(() => {
    if (visible) {
      const fetchLogFiles = async (): Promise<void> => {
        try {
          setIsLoading(true)
          setFileSizes({}) // Reset file sizes when reopening
          setLogStatus("Checking log status...")

          // Check if logging is active
          const isActive = Client.isLogWriterActive()
          setLogStatus(`Logging ${isActive ? "is active" : "is NOT active"}`)

          const files = getXmtpFilePaths()
          setLogFiles(files)

          if (files.length === 0) {
            setLogStatus((prev) => `${prev}\nNo log files found. Try activating logs first.`)
          } else {
            setLogStatus((prev) => `${prev}\nFound ${files.length} log file(s)`)
          }

          // Load file sizes in parallel
          const sizePromises = files.map(async (path) => {
            try {
              const content = await Client.readXMTPLogFile(path)
              return {
                path,
                size: `${(content.length / 1024).toFixed(2)} KB`,
                isEmpty: content.length === 0,
              }
            } catch (error) {
              captureError(
                new GenericError({ error, additionalMessage: `Error loading size for ${path}` }),
              )
              return { path, size: "Error loading size", isEmpty: true }
            }
          })

          const results = await Promise.all(sizePromises)

          // Update all sizes at once
          const newSizes: Record<string, string> = {}

          results.forEach(({ path, size, isEmpty }) => {
            newSizes[path] = isEmpty ? `${size} (empty)` : size
          })

          setFileSizes(newSizes)
        } catch (error) {
          captureError(new GenericError({ error, additionalMessage: "Error fetching log files" }))
          setLogStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
          setIsLoading(false)
        }
      }

      fetchLogFiles()
    }
  }, [visible])

  // Function to share a log file
  const shareLogFile = useCallback(async (filePath: string): Promise<void> => {
    try {
      // Read the log file content
      const content = await Client.readXMTPLogFile(filePath)

      if (content.length === 0) {
        Alert.alert("Empty Log File", "This log file is empty. Try generating some logs first.")
        return
      }

      // Share the log file
      shareContent({
        title: `XMTP Log: ${filePath.split("/").pop()}`,
        url: `file://${filePath}`,
        type: "text/plain",
      }).catch(captureError)
    } catch (error) {
      captureError(new GenericError({ error, additionalMessage: "Error sharing log file" }))
      Alert.alert("Error", "Failed to share log file")
    }
  }, [])

  const onClose = useCallback(() => {
    useXmtpLogFilesModalStore.getState().actions.setVisible(false)
  }, [])

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      {visible && (
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background.surface }]}>
            <Text style={styles.modalTitle}>XMTP Log Files</Text>

            {/* Display log status information */}
            {logStatus ? (
              <View style={styles.statusContainer}>
                <Text preset="small" color="secondary">
                  {logStatus}
                </Text>
              </View>
            ) : null}

            {isLoading ? (
              <Center style={{ padding: theme.spacing.lg }}>
                <Loader />
                <Text color="secondary" style={{ marginTop: theme.spacing.sm }}>
                  Loading log files...
                </Text>
              </Center>
            ) : logFiles.length === 0 ? (
              <Center style={{ padding: theme.spacing.lg }}>
                <Text color="secondary">No log files found</Text>
              </Center>
            ) : (
              <FlatList
                data={logFiles}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.logFileItem, { borderBottomColor: theme.colors.border.subtle }]}
                    onPress={() => shareLogFile(item)}
                  >
                    <Text numberOfLines={1} ellipsizeMode="middle">
                      {item.split("/").pop()}
                    </Text>
                    <HStack
                      style={{ justifyContent: "space-between", marginTop: theme.spacing.xxs }}
                    >
                      <Text preset="small" color="secondary">
                        {fileSizes[item] || "Loading..."}
                      </Text>
                      <Text preset="small" color="primary" style={{ fontStyle: "italic" }}>
                        Tap to share
                      </Text>
                    </HStack>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: theme.spacing.md }}
              />
            )}

            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 20,
  },
  modalContent: {
    borderRadius: 10,
    padding: 20,
    width: "100%",
    maxHeight: "80%",
  },
  modalTitle: {
    marginBottom: 15,
    textAlign: "center",
  },
  logFileItem: {
    padding: 10,
    borderBottomWidth: 1,
  },
  statusContainer: {
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
})
