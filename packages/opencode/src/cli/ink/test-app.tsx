/** @jsxImportSource react */
import { Box, Text } from "ink"

export const TestApp = () => {
  console.error("DEBUG: TestApp rendering")
  return (
    <Box flexDirection="column">
      <Text>Hello from oclite!</Text>
      <Text>This is a test.</Text>
      <Text color="green">Green text</Text>
      <Text color="red">Red text</Text>
    </Box>
  )
}
