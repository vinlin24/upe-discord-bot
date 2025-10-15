// The single designated site for loading & validating environment variables
// from the local .env file.

import * as dotenv from "dotenv";
import * as envalid from "envalid";

import type {
  ChannelId,
  QuarterName,
  SeasonId,
  UrlString,
  UserId,
} from "./types/branded.types";

const dotEnvOutput = dotenv.config();
if (dotEnvOutput.error) {
  throw dotEnvOutput.error;
}

function makeBrandedValidator<BrandedType>(matcher: RegExp) {
  return envalid.makeValidator<BrandedType>(input => {
    if (!matcher.test(input)) {
      throw new Error(`expected value matching ${matcher}`);
    }
    return input as BrandedType;
  });
}

const userIdValidator = makeBrandedValidator<UserId>(/^[0-9]+$/);
const channelIdValidator = makeBrandedValidator<ChannelId>(/^[0-9]+$/);
const urlStringValidator = envalid.url<UrlString>;
const seasonIdValidator = makeBrandedValidator<SeasonId>(/^[FS][0-9]+$/);
const quarterNameValidator = makeBrandedValidator<QuarterName>(
  /^(Fall|Winter|Spring) [0-9]+$/,
);

export const ENV_SPEC = {
  BOT_TOKEN: envalid.str({
    desc: "Discord bot token generated on the Discord Developer Dashboard.",
  }),

  APPLICATION_ID: envalid.str({
    desc: "Client application ID generated on the Discord Developer Dashboard.",
  }),

  INDUCTION_EMAIL: envalid.email({
    desc: "Email inductees use for private queries to the Induction committee.",
  }),

  INDUCTION_ANNOUNCEMENTS_CHANNEL_ID: channelIdValidator({
    desc: "Discord ID of the seasonal induction announcements channel.",
  }),

  INDUCTEES_CHAT_CHANNEL_ID: channelIdValidator({
    desc: "Discord ID of the seasonal inductees chat channel.",
  }),

  INDUCTEE_DATA_SPREADSHEET_ID: envalid.str({
    desc: "ID of the seasonal inductee data Google Sheets spreadsheet.",
  }),

  BIT_DATA_SPREADSHEET_ID: envalid.str({
    desc: "ID of the seasonal bit-byte data Google Sheets spreadsheet.",
  }),

  REQUIREMENTS_DOCUMENT_LINK: urlStringValidator({
    desc: "URL of the seasonal induction requirements document.",
  }),

  PRIVATE_REQUIREMENT_TRACKER_SPREADSHEET_ID: envalid.str({
    desc:
      "ID of the seasonal private induction requirement tracker " +
      "Google Sheets spreadsheet.",
  }),

  TUTORING_TRACKER_SPREADSHEET_ID: envalid.str({
    desc:
      "ID of the seasonal private tutoring requirement tracker " +
      "Google Sheets spreadsheet.",
  }),

  PUBLIC_REQUIREMENT_TRACKER_SPREADSHEET_URL: urlStringValidator({
    desc:
      "URL of the seasonal public induction requirement tracker " +
      "Google Sheets spreadsheet.",
  }),

  REVIEW_EVENTS_SPREADSHEET_ID: envalid.str({
    desc:
      "ID of the quarterly tutoring review events schedule " +
      "Google Sheets spreadsheet.",
  }),

  SEASON_ID: seasonIdValidator({
    desc: "Abbreviated induction season name.",
    example: "S25",
  }),

  QUARTER_NAME: quarterNameValidator({
    desc: "Academic quarter name.",
    example: "Spring 2025",
  }),

  DB_NAME: envalid.str({
    desc: "MongoDB database to use.",
  }),

  DB_CONNECTION_STRING: urlStringValidator({
    desc: "Connection string for the MongoDB service.",
  }),
};

const env = envalid.cleanEnv(dotEnvOutput.parsed, ENV_SPEC);
export default env;
