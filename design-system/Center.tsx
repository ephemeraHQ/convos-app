import { ForwardedRef, forwardRef } from "react"
import { View } from "react-native"
import Animated, { AnimatedProps } from "react-native-reanimated"
import { IExtendedEdge, useSafeAreaInsetsStyle } from "@/components/screen/screen.helpers"
import { HStack, IHStackProps } from "./HStack"
import { VStack } from "./VStack"

export type ICenterProps = IHStackProps & {
  vertical?: boolean
  safeAreaInsets?: IExtendedEdge[]
}

export const Center = forwardRef((props: ICenterProps, ref: ForwardedRef<View>) => {
  const { style, vertical = false, safeAreaInsets, ...rest } = props

  const Stack = vertical ? VStack : HStack

  const safeAreaInsetsStyle = useSafeAreaInsetsStyle(safeAreaInsets ?? [])

  return (
    <Stack
      ref={ref}
      style={[{ alignItems: "center", justifyContent: "center" }, safeAreaInsetsStyle, style]}
      {...rest}
    />
  )
})

export type IAnimatedCenterProps = AnimatedProps<ICenterProps>

export const AnimatedCenter = Animated.createAnimatedComponent(Center)
