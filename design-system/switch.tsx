import { memo } from "react"
import { Switch as RNSwitch, SwitchProps } from "react-native"

export const Switch = memo(function Switch(props: SwitchProps) {
  return <RNSwitch {...props} />
})
