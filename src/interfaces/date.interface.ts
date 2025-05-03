import type { UnixSeconds } from "../types/branded.types";

export interface IDateClient {
  getNow(): UnixSeconds;
}
