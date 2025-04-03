import type { UnixSeconds } from "../types/branded.types";

export interface DateClient {
  getNow(): UnixSeconds;
}

export class SystemDateClient implements DateClient {
  public getNow(): UnixSeconds {
    return Math.round(Date.now() / 1000) as UnixSeconds;
  }
}
