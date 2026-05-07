import { BusEvent } from "@/bus/bus-event"
import { PermissionNext } from "@/permission/next"
import z from "zod"

export const ConnectedEvent = BusEvent.define("server.connected", z.object({}))
export const DisposedEvent = BusEvent.define("global.disposed", z.object({}))

// Lazy getter to ensure PermissionNext is loaded before accessing Event.Asked
export const Event = {
  Connected: ConnectedEvent,
  Disposed: DisposedEvent,
  get PermissionAsked() {
    return PermissionNext.Event.Asked
  },
}
