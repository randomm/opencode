export function createSpinner(text: string) {
  // CRITICAL FIX #4: Defense-in-depth TTY check
  if (!process.stdout.isTTY) {
    return { stop: () => {} } // Noop for non-TTY
  }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
  let frame = 0
  let interval: Timer | null = null
  let stopped = false // CRITICAL FIX #3: Prevent double-stop
  const start = Date.now()

  process.stdout.write("\x1B[?25l") // hide cursor

  interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000)
    const time = elapsed > 0 ? ` ${elapsed}s` : ""
    process.stdout.write(`\r\x1B[K\x1B[36m${frames[frame]}\x1B[0m ${text}${time}`)
    frame = (frame + 1) % frames.length
  }, 50)

  // ISSUE FIX #5: Cleanup on signals
  const cleanup = () => {
    if (!stopped && interval) {
      clearInterval(interval)
      process.stdout.write("\x1B[?25h")
      stopped = true
    }
  }
  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  return {
    stop: (success = true) => {
      // CRITICAL FIX #3: Guard against double stop
      if (stopped) return
      stopped = true

      if (interval) clearInterval(interval)
      const icon = success ? "\x1B[32m✓\x1B[0m" : "\x1B[31m✗\x1B[0m"
      process.stdout.write(`\r\x1B[K${icon} ${text}\n`)
      process.stdout.write("\x1B[?25h") // show cursor

      // Remove signal handlers
      process.off("SIGINT", cleanup)
      process.off("SIGTERM", cleanup)
    },
  }
}
