import { StyleProp, TextStyle } from "react-native"
import { IThemed } from "@/theme/use-app-theme"
import { textPresets } from "./Text.presets"
import { IInvertedTextColors, ITextColors, ITextStyleProps } from "./Text.props"
import {
  invertedTextColorStyle,
  textColorStyle,
  textFontWeightStyles,
  textSizeStyles,
} from "./Text.styles"

export const getTextStyle = (
  themed: IThemed,
  { weight, size, color, style, inverted, preset = "body", disabled, ...props }: ITextStyleProps,
): StyleProp<TextStyle> => {
  const $styles: StyleProp<TextStyle> = [
    themed(textPresets[preset]),
    inverted && themed((theme) => ({ color: theme.colors.text.inverted.primary })),
    weight && textFontWeightStyles[weight],
    size && textSizeStyles[size],
    disabled && themed((theme) => ({ color: theme.colors.text.tertiary })),
    color &&
      themed((theme) => {
        // For now all disabled text should be tertiary
        if (disabled) {
          return { color: theme.colors.text.tertiary }
        }

        return inverted
          ? invertedTextColorStyle(theme, color as IInvertedTextColors)
          : textColorStyle(theme, color as ITextColors)
      }),
    style,
  ]

  return $styles
}
