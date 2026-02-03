/** @jsxImportSource react */
import type { ReactElement, ReactNode } from "react"

declare module "ink" {
  import type { ForwardRefExoticComponent, RefAttributes } from "react"

  export interface BoxProps {
    readonly position?: "absolute" | "relative"
    readonly columnGap?: number
    readonly rowGap?: number
    readonly gap?: number
    readonly margin?: number
    readonly marginLeft?: number
    readonly marginRight?: number
    readonly marginTop?: number
    readonly marginBottom?: number
    readonly marginX?: number
    readonly marginY?: number
    readonly padding?: number
    readonly paddingLeft?: number
    readonly paddingRight?: number
    readonly paddingTop?: number
    readonly paddingBottom?: number
    readonly paddingX?: number
    readonly paddingY?: number
    readonly flexDirection?: "row" | "column" | "row-reverse" | "column-reverse"
    readonly flexGrow?: number
    readonly flexShrink?: number
    readonly flexBasis?: number | string
    readonly alignItems?: "flex-start" | "center" | "flex-end" | "stretch"
    readonly alignSelf?: "auto" | "flex-start" | "center" | "flex-end" | "stretch"
    readonly justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly"
    readonly width?: number | string
    readonly height?: number | string
    readonly minWidth?: number | string
    readonly minHeight?: number | string
    readonly maxWidth?: number | string
    readonly maxHeight?: number | string
    readonly borderStyle?: "single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic"
    readonly borderColor?: string
    readonly borderTop?: boolean
    readonly borderRight?: boolean
    readonly borderBottom?: boolean
    readonly borderLeft?: boolean
    readonly display?: "flex" | "none"
    readonly overflowX?: "visible" | "hidden"
    readonly overflowY?: "visible" | "hidden"
    readonly overflow?: "visible" | "hidden"
    readonly children?: ReactNode
  }

  export const Box: (props: BoxProps) => ReactElement

  export interface TextProps {
    readonly color?: string
    readonly backgroundColor?: string
    readonly dimColor?: boolean
    readonly bold?: boolean
    readonly italic?: boolean
    readonly underline?: boolean
    readonly strikethrough?: boolean
    readonly inverse?: boolean
    readonly wrap?: "wrap" | "truncate" | "truncate-start" | "truncate-middle" | "truncate-end"
    readonly children?: ReactNode
  }

  export const Text: (props: TextProps) => ReactElement

  export interface StaticProps<T> {
    readonly items: readonly T[]
    readonly children: (item: T, index: number) => ReactNode
  }

  export function Static<T>(props: StaticProps<T>): ReactElement

  export interface UseInputOptions {
    readonly isActive?: boolean
  }

  export function useInput(handler: (input: string, key: Key) => void, options?: UseInputOptions): void

  export interface Key {
    readonly upArrow: boolean
    readonly downArrow: boolean
    readonly leftArrow: boolean
    readonly rightArrow: boolean
    readonly pageDown: boolean
    readonly pageUp: boolean
    readonly return: boolean
    readonly escape: boolean
    readonly ctrl: boolean
    readonly shift: boolean
    readonly tab: boolean
    readonly backspace: boolean
    readonly delete: boolean
    readonly meta: boolean
  }

  export interface UseStdinResult {
    readonly stdin: NodeJS.ReadStream
    readonly isRawModeSupported: boolean
    readonly setRawMode: (mode: boolean) => void
  }

  export function useStdin(): UseStdinResult
}
