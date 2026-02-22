import { describe, expect, test } from "bun:test"
import { Event } from "../../src/server/event"
import { PermissionNext } from "../../src/permission/next"

describe("server/event", () => {
  test("exports permission.asked event with correct schema", () => {
    // Verify the PermissionAsked event exists
    expect(Event.PermissionAsked).toBeDefined()

    // Verify it references the same event object from permission/next.ts
    expect(Event.PermissionAsked).toBe(PermissionNext.Event.Asked)

    // Verify the event type is correct
    expect(Event.PermissionAsked.type).toBe("permission.asked")

    // Verify the schema has the expected structure
    const samplePayload = {
      id: "perm_123",
      sessionID: "ses_456",
      permission: "bash",
      patterns: ["*"],
      metadata: {},
      always: [],
      tool: {
        messageID: "msg_789",
        callID: "call_abc",
      },
    }

    // Verify the payload can be parsed by the schema
    const result = Event.PermissionAsked.properties.safeParse(samplePayload)
    expect(result.success).toBe(true)

    // Verify optional tool field can be omitted
    const resultWithoutTool = Event.PermissionAsked.properties.safeParse({
      ...samplePayload,
      tool: undefined,
    })
    expect(resultWithoutTool.success).toBe(true)
  })

  test("lazy getter prevents module load order issues", () => {
    // Access via getter multiple times to ensure it's evaluated correctly
    const event1 = Event.PermissionAsked
    const event2 = Event.PermissionAsked

    // Both accesses should return the same object (singleton)
    expect(event1).toBe(event2)
    expect(event1).toBe(PermissionNext.Event.Asked)
  })
})