import { DateTime, type DateObjectUnits } from "luxon";

import {
  isBrandedNumber,
  asBrandedNumber,
  type UnixSeconds,
} from "../types/branded.types";

export interface IDateClient {
  getNow(): UnixSeconds;
  getDate(seconds: UnixSeconds): Date;
  getDateTime(seconds: UnixSeconds, zone?: string): DateTime;
  getDateTime(units: DateObjectUnits, zone?: string): DateTime;
}

export class SystemDateClient implements IDateClient {
  public getNow(): UnixSeconds {
    return Math.round(Date.now() / 1000) as UnixSeconds;
  }

  public getDate(seconds: UnixSeconds): Date {
    return new Date(seconds * 1000);
  }

  public getDateTime(
    arg: UnixSeconds | DateObjectUnits | Date,
    zone?: string,
  ): DateTime {
    if (isBrandedNumber<UnixSeconds>(arg)) {
      return DateTime.fromSeconds(arg, { zone });
    }
    if (arg instanceof Date) {
      return DateTime.fromJSDate(arg, { zone });
    }
    return DateTime.fromObject(arg, { zone });
  }
}

export function msecToUnixSeconds(milliseconds: number): UnixSeconds {
  return Math.round(milliseconds / 1000) as UnixSeconds;
}

export function isoToUnixSeconds(isoString: string): UnixSeconds {
  const unixMsec = new Date(isoString).getTime();
  return msecToUnixSeconds(unixMsec);
}

export function dateToUnixSeconds(date: Date): UnixSeconds {
  const unixMsec = date.getTime();
  return msecToUnixSeconds(unixMsec);
}

export function getNextMidnight(
  now: UnixSeconds,
  dateClient: IDateClient,
): UnixSeconds {
  const dateTime = dateClient.getDateTime(now, UCLA_TIMEZONE);
  if (!dateTime.isValid) {
    throw new Error(
      `timestamp ${now} failed to convert: ${dateTime.invalidExplanation}`,
    );
  }
  const nextMidnight = dateTime.plus({ days: 1 }).startOf("day");
  return asBrandedNumber(nextMidnight.toSeconds());
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

export const MONTH_NAMES = Object.values(Month).filter(
  (value) => typeof value === "string",
) as MonthName[];

export enum IanaTimeZone {
  AmericaLosAngeles = "America/Los_Angeles",
}

export const UCLA_TIMEZONE = IanaTimeZone.AmericaLosAngeles;

export const ONE_DAY_MSEC = 24 * 3600 * 1000;
