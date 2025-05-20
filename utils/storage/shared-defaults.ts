import { Settings } from "react-native"

export const sharedDefaults = {
  setValue: (key: string, value: string) => {
    Settings.set({
      [key]: value,
    })
  },
  getValue: (key: string) => {
    return Settings.get(key)
  },
  deleteValue: (key: string) => {
    Settings.set({
      [key]: undefined,
    })
  },
}
