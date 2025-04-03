import type { UnixSeconds } from "../types/branded.types";

export interface IDateClient {
  getNow(): UnixSeconds;
}

export class SystemDateClient implements IDateClient {
  public getNow(): UnixSeconds {
    return Math.round(Date.now() / 1000) as UnixSeconds;
  }
}
