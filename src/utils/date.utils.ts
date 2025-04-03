import type { UnixSeconds } from "../types/branded.types";

export interface IDateClient {
  getNow(): UnixSeconds;
  getDate(seconds: UnixSeconds): Date;
}

export class SystemDateClient implements IDateClient {
  public getNow(): UnixSeconds {
    return Math.round(Date.now() / 1000) as UnixSeconds;
  }

  public getDate(seconds: UnixSeconds): Date {
    return new Date(seconds * 1000);
  }
}
