import { style, fg } from "./terminal"

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
  },

  // Status indicators
  status: {
    success: fg.green,
    error: fg.red,
    warning: fg.yellow,
    info: fg.cyan,
  },
}
