import React, { ForwardedRef, forwardRef, memo } from "react"
import { View, ViewProps } from "react-native"
import Animated, { AnimatedProps } from "react-native-reanimated"
import { IExtendedEdge, useSafeAreaInsetsStyle } from "@/components/screen/screen.helpers"

export type IHStackProps = ViewProps & {
  safeAreaInsets?: IExtendedEdge[]
}

export const HStack = memo(
  forwardRef((props: IHStackProps, ref: ForwardedRef<View>) => {
    const { safeAreaInsets, ...restProps } = props

    const safeAreaInsetsStyle = useSafeAreaInsetsStyle(safeAreaInsets ?? [])

    return (
      <View
        ref={ref}
        {...restProps}
        style={[
          {
            flexDirection: "row",
          },
          safeAreaInsetsStyle,
          props.style,
        ]}
      />
    )
  }),
)

export type IAnimatedHStackProps = AnimatedProps<IHStackProps>

export const AnimatedHStack = Animated.createAnimatedComponent(HStack)
