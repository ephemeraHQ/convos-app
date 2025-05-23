import React, { ForwardedRef, forwardRef, memo, ReactNode } from "react"
import { View, ViewProps } from "react-native"
import Animated, { AnimatedProps } from "react-native-reanimated"
import { ExtendedEdge, useSafeAreaInsetsStyle } from "@/components/screen/screen.helpers"

export type IVStackProps = ViewProps & {
  separator?: ReactNode
  safeAreaInsets?: ExtendedEdge[]
}

export const VStack = memo(
  forwardRef((props: IVStackProps, ref: ForwardedRef<View>) => {
    const { separator, children, safeAreaInsets, ...restProps } = props

    const safeAreaInsetsStyle = useSafeAreaInsetsStyle(safeAreaInsets ?? [])

    const renderChildren = React.useMemo(() => {
      const childrenArray = React.Children.toArray(children)
      return childrenArray.map((child, index) => (
        <React.Fragment key={index}>
          {child}
          {separator && index < childrenArray.length - 1 && separator}
        </React.Fragment>
      ))
    }, [children, separator])

    return (
      <View
        ref={ref}
        {...restProps}
        style={[
          {
            flexDirection: "column",
          },
          safeAreaInsetsStyle,
          props.style,
        ]}
      >
        {separator ? renderChildren : children}
      </View>
    )
  }),
)

export type IAnimatedVStackProps = AnimatedProps<IVStackProps>

export const AnimatedVStack = Animated.createAnimatedComponent(VStack)
