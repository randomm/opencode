import { style, fg } from "./terminal"
import { rgb } from "./terminal"

export const theme = {
  // Tool display
  tool: {
    done: {
      icon: fg.green,
      text: `${style.dim}${fg.gray}`,
    },
    running: {
      icon: fg.yellow,
      text: `${style.dim}${fg.gray}`,
    },
    error: {
      icon: fg.red,
      text: fg.red,
    },
    denied: {
      icon: fg.red,
      text: fg.red,
    },
  },

  // Task (subagent) display
  task: {
    done: {
      icon: fg.green,
      text: `${fg.cyan}`,
    },
    running: {
      icon: fg.yellow,
      text: `${fg.cyan}`,
    },
  },

  // Text content
  prose: {
    text: "", // No color override, use terminal default
    bg: rgb(26, 26, 46).bg, // Subtle dark background #1a1a2e
  },

  // Status indicators
  status: {
    success: fg.green,
    error: fg.red,
    warning: fg.yellow,
    info: fg.cyan,
  },
}
