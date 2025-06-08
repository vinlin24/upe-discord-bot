import { DateTime, type DateObjectUnits } from "luxon";
import type { UnixSeconds } from "../types/branded.types";

export interface IDateClient {
  getNow(): UnixSeconds;
  getDate(seconds: UnixSeconds): Date;
  getDateTime(units: DateObjectUnits, zone?: string): DateTime;
}

export class SystemDateClient implements IDateClient {
  public getNow(): UnixSeconds {
    return Math.round(Date.now() / 1000) as UnixSeconds;
  }

  public getDate(seconds: UnixSeconds): Date {
    return new Date(seconds * 1000);
  }

  public getDateTime(units: DateObjectUnits, zone?: string): DateTime {
    return DateTime.fromObject(units, { zone });
  }
}

export function msecToUnixSeconds(milliseconds: number): UnixSeconds {
  return Math.round(milliseconds / 1000) as UnixSeconds;
}

export function isoToUnixSeconds(isoString: string): UnixSeconds {
  const unixMsec = new Date(isoString).getTime();
  return msecToUnixSeconds(unixMsec);
}

export enum Month {
  January = 1,
  February,
  March,
  April,
  May,
  June,
  July,
  August,
  September,
  October,
  November,
  December,
}

export type MonthName = keyof typeof Month;

export const MONTH_NAMES = Object.values(Month)
  .filter(value => typeof value === "string") as MonthName[];
