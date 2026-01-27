import { cursor, clear, style, fg } from "./terminal"

const write = (s: string) => process.stdout.write(s)

export function createLayout() {
  let rows = process.stdout.rows || 24
  let cols = process.stdout.columns || 80

  const PANEL_HEIGHT = 3
  let mode: "scroll" | "input" = "input"

  function setup() {
    const scrollBottom = rows - PANEL_HEIGHT
    if (scrollBottom < 2) {
      return
    }
    write(`\x1b[1;${scrollBottom}r`)
    write(`\x1b[${scrollBottom};1H`)
    renderPanel()
  }

  function cleanup() {
    write(`\x1b[r`)
    write(cursor.show)
  }

  function resize() {
    rows = process.stdout.rows || 24
    cols = process.stdout.columns || 80
    const scrollBottom = rows - PANEL_HEIGHT
    if (scrollBottom < 2) {
      return
    }
    setup()
  }

  function writeToScroll(text: string) {
    write(text)
  }

  let statusText = ""
  let inputText = ""
  let hintText = ""

  function setStatus(text: string) {
    statusText = text
    renderStatusLine()
  }

  function setInput(text: string) {
    inputText = text
    renderInputLine()
  }

  function setHint(text: string) {
    hintText = text
    renderHintLine()
  }

  function renderPanel() {
    renderStatusLine()
    renderInputLine()
    renderHintLine()
  }

  function returnCursor() {
    if (mode === "input") {
      write(`\x1b[${rows - 1};1H`)
    } else {
      write(`\x1b[${rows - PANEL_HEIGHT};1H`)
    }
  }

  function renderStatusLine() {
    const row = rows - 2
    write(`\x1b[${row};1H`)
    write(clear.line)
    write(statusText)
    returnCursor()
  }

  function renderInputLine() {
    const row = rows - 1
    write(`\x1b[${row};1H`)
    write(clear.line)
    write(inputText)
    returnCursor()
  }

  function renderHintLine() {
    const row = rows
    write(`\x1b[${row};1H`)
    write(clear.line)
    write(`${fg.gray}${hintText}${style.reset}`)
    returnCursor()
  }

  function focusInput(prompt: string) {
    const row = rows - 1
    write(`\x1b[${row};1H`)
    write(clear.line)
    write(prompt)
  }

  return {
    setup,
    cleanup,
    resize,
    write: writeToScroll,
    setStatus,
    setInput,
    setHint,
    focusInput,
    setMode: (m: "scroll" | "input") => {
      mode = m
    },
    get rows() {
      return rows
    },
    get cols() {
      return cols
    },
  }
}

export type Layout = ReturnType<typeof createLayout>
