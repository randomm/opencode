export function formatScenarios(scenarios: Array<{scenario: string, result: string}> | undefined): string {
  if (!scenarios || scenarios.length === 0) {
    return "  - None specified"
  }
  return scenarios.map(s => `  - ${s.scenario}: ${s.result}`).join("\n")
}