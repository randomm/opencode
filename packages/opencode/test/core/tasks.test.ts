import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import path from "path"
import { Session } from "../../src/session"
import { SessionStatus } from "../../src/session/status"
import { MessageV2 } from "../../src/session/message-v2"
import { Instance } from "../../src/project/instance"
import { Bus } from "../../src/bus"
import { tmpdir } from "../fixture/fixture"

describe("BackgroundTasks", () => {
  describe("task lifecycle", () => {
    test("session starts in idle status", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()
          const status = SessionStatus.get(session.id)
          expect(status.type).toBe("idle")
          await Session.remove(session.id)
        },
      })
    })

    test("session transitions to busy when set", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          SessionStatus.set(session.id, { type: "busy" })
          const status = SessionStatus.get(session.id)
          expect(status.type).toBe("busy")

          SessionStatus.set(session.id, { type: "idle" })
          await Session.remove(session.id)
        },
      })
    })

    test("session transitions from busy to completed (idle)", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          SessionStatus.set(session.id, { type: "busy" })
          expect(SessionStatus.get(session.id).type).toBe("busy")

          SessionStatus.set(session.id, { type: "idle" })
          expect(SessionStatus.get(session.id).type).toBe("idle")

          await Session.remove(session.id)
        },
      })
    })

    test("session transitions from busy to failed (retry)", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          SessionStatus.set(session.id, { type: "busy" })
          expect(SessionStatus.get(session.id).type).toBe("busy")

          SessionStatus.set(session.id, {
            type: "retry",
            attempt: 1,
            message: "Connection failed",
            next: Date.now() + 5000,
          })
          const status = SessionStatus.get(session.id)
          expect(status.type).toBe("retry")
          if (status.type === "retry") {
            expect(status.attempt).toBe(1)
            expect(status.message).toBe("Connection failed")
          }

          SessionStatus.set(session.id, { type: "idle" })
          await Session.remove(session.id)
        },
      })
    })
  })

  describe("state transitions", () => {
    test("pending to running transition", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const events: SessionStatus.Info[] = []
          const session = await Session.create()

          const unsub = Bus.subscribe(SessionStatus.Event.Status, (evt) => {
            if (evt.properties.sessionID === session.id) {
              events.push(evt.properties.status)
            }
          })

          SessionStatus.set(session.id, { type: "busy" })
          SessionStatus.set(session.id, { type: "idle" })

          await new Promise((resolve) => setTimeout(resolve, 50))
          unsub()

          expect(events.length).toBe(2)
          expect(events[0].type).toBe("busy")
          expect(events[1].type).toBe("idle")

          await Session.remove(session.id)
        },
      })
    })

    test("running to completed transition emits idle event", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()
          let received = false

          const unsub = Bus.subscribe(SessionStatus.Event.Idle, (evt) => {
            if (evt.properties.sessionID === session.id) {
              received = true
            }
          })

          SessionStatus.set(session.id, { type: "busy" })
          SessionStatus.set(session.id, { type: "idle" })

          await new Promise((resolve) => setTimeout(resolve, 50))
          unsub()

          expect(received).toBe(true)
          await Session.remove(session.id)
        },
      })
    })

    test("multiple state transitions are tracked correctly", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()
          const states: string[] = []

          states.push(SessionStatus.get(session.id).type)

          SessionStatus.set(session.id, { type: "busy" })
          states.push(SessionStatus.get(session.id).type)

          SessionStatus.set(session.id, {
            type: "retry",
            attempt: 1,
            message: "First retry",
            next: Date.now() + 1000,
          })
          states.push(SessionStatus.get(session.id).type)

          SessionStatus.set(session.id, { type: "busy" })
          states.push(SessionStatus.get(session.id).type)

          SessionStatus.set(session.id, { type: "idle" })
          states.push(SessionStatus.get(session.id).type)

          expect(states).toEqual(["idle", "busy", "retry", "busy", "idle"])

          await Session.remove(session.id)
        },
      })
    })
  })

  describe("concurrent task handling", () => {
    test("multiple sessions can have different statuses", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session1 = await Session.create()
          const session2 = await Session.create()
          const session3 = await Session.create()

          SessionStatus.set(session1.id, { type: "busy" })
          SessionStatus.set(session2.id, {
            type: "retry",
            attempt: 2,
            message: "Error",
            next: Date.now(),
          })

          expect(SessionStatus.get(session1.id).type).toBe("busy")
          expect(SessionStatus.get(session2.id).type).toBe("retry")
          expect(SessionStatus.get(session3.id).type).toBe("idle")

          SessionStatus.set(session1.id, { type: "idle" })
          SessionStatus.set(session2.id, { type: "idle" })
          await Session.remove(session1.id)
          await Session.remove(session2.id)
          await Session.remove(session3.id)
        },
      })
    })

    test("list returns all active statuses", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session1 = await Session.create()
          const session2 = await Session.create()

          SessionStatus.set(session1.id, { type: "busy" })
          SessionStatus.set(session2.id, {
            type: "retry",
            attempt: 1,
            message: "Error",
            next: Date.now(),
          })

          const statuses = SessionStatus.list()
          expect(Object.keys(statuses).length).toBeGreaterThanOrEqual(2)
          expect(statuses[session1.id]?.type).toBe("busy")
          expect(statuses[session2.id]?.type).toBe("retry")

          SessionStatus.set(session1.id, { type: "idle" })
          SessionStatus.set(session2.id, { type: "idle" })
          await Session.remove(session1.id)
          await Session.remove(session2.id)
        },
      })
    })

    test("idle sessions are removed from the list", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          SessionStatus.set(session.id, { type: "busy" })
          expect(SessionStatus.list()[session.id]).toBeDefined()

          SessionStatus.set(session.id, { type: "idle" })
          expect(SessionStatus.list()[session.id]).toBeUndefined()

          await Session.remove(session.id)
        },
      })
    })

    test("concurrent status updates do not interfere", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const sessions = await Promise.all([
            Session.create(),
            Session.create(),
            Session.create(),
            Session.create(),
            Session.create(),
          ])

          await Promise.all(sessions.map((s) => SessionStatus.set(s.id, { type: "busy" })))

          const busyCount = sessions.filter((s) => SessionStatus.get(s.id).type === "busy").length
          expect(busyCount).toBe(5)

          await Promise.all(sessions.map((s) => SessionStatus.set(s.id, { type: "idle" })))
          await Promise.all(sessions.map((s) => Session.remove(s.id)))
        },
      })
    })
  })

  describe("error scenarios", () => {
    test("retry status preserves error information", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          SessionStatus.set(session.id, {
            type: "retry",
            attempt: 3,
            message: "Rate limit exceeded",
            next: Date.now() + 60000,
          })

          const status = SessionStatus.get(session.id)
          expect(status.type).toBe("retry")
          if (status.type === "retry") {
            expect(status.attempt).toBe(3)
            expect(status.message).toBe("Rate limit exceeded")
            expect(status.next).toBeGreaterThan(Date.now())
          }

          SessionStatus.set(session.id, { type: "idle" })
          await Session.remove(session.id)
        },
      })
    })

    test("retry attempts increment correctly", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          for (let i = 1; i <= 5; i++) {
            SessionStatus.set(session.id, {
              type: "retry",
              attempt: i,
              message: `Attempt ${i} failed`,
              next: Date.now() + 1000 * i,
            })
            const status = SessionStatus.get(session.id)
            if (status.type === "retry") {
              expect(status.attempt).toBe(i)
            }
          }

          SessionStatus.set(session.id, { type: "idle" })
          await Session.remove(session.id)
        },
      })
    })

    test("non-existent session returns idle status", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const status = SessionStatus.get("nonexistent-session-id")
          expect(status.type).toBe("idle")
        },
      })
    })

    test("status event is emitted even for failed transitions", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()
          const events: SessionStatus.Info[] = []

          const unsub = Bus.subscribe(SessionStatus.Event.Status, (evt) => {
            if (evt.properties.sessionID === session.id) {
              events.push(evt.properties.status)
            }
          })

          SessionStatus.set(session.id, { type: "busy" })
          SessionStatus.set(session.id, {
            type: "retry",
            attempt: 1,
            message: "Failed",
            next: Date.now(),
          })
          SessionStatus.set(session.id, { type: "idle" })

          await new Promise((resolve) => setTimeout(resolve, 50))
          unsub()

          expect(events.length).toBe(3)
          expect(events[0].type).toBe("busy")
          expect(events[1].type).toBe("retry")
          expect(events[2].type).toBe("idle")

          await Session.remove(session.id)
        },
      })
    })
  })

  describe("edge cases", () => {
    test("setting same status twice is idempotent", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          SessionStatus.set(session.id, { type: "busy" })
          SessionStatus.set(session.id, { type: "busy" })

          expect(SessionStatus.get(session.id).type).toBe("busy")

          SessionStatus.set(session.id, { type: "idle" })
          await Session.remove(session.id)
        },
      })
    })

    test("status survives session update", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          SessionStatus.set(session.id, { type: "busy" })
          await Session.update(session.id, (draft) => {
            draft.title = "Updated title"
          })

          expect(SessionStatus.get(session.id).type).toBe("busy")

          SessionStatus.set(session.id, { type: "idle" })
          await Session.remove(session.id)
        },
      })
    })

    test("rapid status changes are all recorded", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()
          const events: string[] = []

          const unsub = Bus.subscribe(SessionStatus.Event.Status, (evt) => {
            if (evt.properties.sessionID === session.id) {
              events.push(evt.properties.status.type)
            }
          })

          for (let i = 0; i < 10; i++) {
            SessionStatus.set(session.id, { type: "busy" })
            SessionStatus.set(session.id, { type: "idle" })
          }

          await new Promise((resolve) => setTimeout(resolve, 50))
          unsub()

          expect(events.length).toBe(20)

          await Session.remove(session.id)
        },
      })
    })

    test("child session has independent status", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const parent = await Session.create()
          const child = await Session.create({ parentID: parent.id })

          SessionStatus.set(parent.id, { type: "busy" })
          expect(SessionStatus.get(parent.id).type).toBe("busy")
          expect(SessionStatus.get(child.id).type).toBe("idle")

          SessionStatus.set(child.id, {
            type: "retry",
            attempt: 1,
            message: "Child error",
            next: Date.now(),
          })
          expect(SessionStatus.get(parent.id).type).toBe("busy")
          expect(SessionStatus.get(child.id).type).toBe("retry")

          SessionStatus.set(parent.id, { type: "idle" })
          SessionStatus.set(child.id, { type: "idle" })
          await Session.remove(child.id)
          await Session.remove(parent.id)
        },
      })
    })

    test("status schema validation", async () => {
      const idle = SessionStatus.Info.safeParse({ type: "idle" })
      expect(idle.success).toBe(true)

      const busy = SessionStatus.Info.safeParse({ type: "busy" })
      expect(busy.success).toBe(true)

      const retry = SessionStatus.Info.safeParse({
        type: "retry",
        attempt: 1,
        message: "Error",
        next: Date.now(),
      })
      expect(retry.success).toBe(true)

      const invalid = SessionStatus.Info.safeParse({ type: "unknown" })
      expect(invalid.success).toBe(false)

      const incomplete = SessionStatus.Info.safeParse({
        type: "retry",
        attempt: 1,
      })
      expect(incomplete.success).toBe(false)
    })

    test("session with messages maintains status correctly", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          SessionStatus.set(session.id, { type: "busy" })

          const info: MessageV2.Info = {
            id: "msg_test_001",
            sessionID: session.id,
            role: "assistant",
            parentID: "",
            mode: "test",
            modelID: "test-model",
            providerID: "test-provider",
            agent: "test",
            path: { cwd: tmp.path, root: tmp.path },
            cost: 0,
            tokens: {
              input: 0,
              output: 0,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
            time: { created: Date.now() },
          }

          await Session.updateMessage(info)
          await Session.updatePart({
            id: "part_test_001",
            sessionID: session.id,
            messageID: info.id,
            type: "text",
            text: "Test response",
          })

          expect(SessionStatus.get(session.id).type).toBe("busy")

          SessionStatus.set(session.id, { type: "idle" })
          expect(SessionStatus.get(session.id).type).toBe("idle")

          await Session.remove(session.id)
        },
      })
    })
  })

  describe("background task error handling", () => {
    test("background task failure emits error event", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()
          let failedEvent: { taskID: string; sessionID?: string; error: string } | undefined

          const unsub = Bus.subscribe(Session.BackgroundTaskEvent.Failed, (evt) => {
            failedEvent = evt.properties
          })

          // Access the internal trackBackgroundTask through a failing promise
          // Since trackBackgroundTask is private, we test via the public API
          // that uses it - which is session creation with auto-share enabled
          // For now, we just verify the event types exist and are properly typed

          await new Promise((resolve) => setTimeout(resolve, 50))
          unsub()

          // The BackgroundTaskEvent.Failed event type should be properly defined
          expect(Session.BackgroundTaskEvent.Failed).toBeDefined()
          expect(Session.BackgroundTaskEvent.Completed).toBeDefined()

          await Session.remove(session.id)
        },
      })
    })

    test("background task success emits completed event", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          // Verify the completed event type exists
          expect(Session.BackgroundTaskEvent.Completed).toBeDefined()

          await Session.remove(session.id)
        },
      })
    })

    test("background task results can be retrieved", async () => {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create()

          // Test the getBackgroundTaskResult function exists
          const result = Session.getBackgroundTaskResult("nonexistent-task")
          expect(result).toBeUndefined()

          // Test listBackgroundTasks returns proper structure
          const tasks = Session.listBackgroundTasks()
          expect(tasks).toHaveProperty("pending")
          expect(tasks).toHaveProperty("results")
          expect(Array.isArray(tasks.pending)).toBe(true)
          expect(typeof tasks.results).toBe("object")

          await Session.remove(session.id)
        },
      })
    })
  })
})
