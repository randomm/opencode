export const questionSubtitle = (count: number, t: (key: string) => string) => {
  if (count === 0) return ""
  if (count === 1) return "1 question"
  return `${count} questions`
}
