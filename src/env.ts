// The single designated site for loading & validating environment variables
// from the local .env file.

import * as dotenv from "dotenv";
import * as envalid from "envalid";

import type {
  ChannelId,
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

export const ENV_SPEC = {
  NODE_ENV: envalid.str({
    choices: ["development", "production"],
    desc:
      "Environment corresponding to the current software " +
      "development lifecycle (SDLC) stage.",
  }),

  BOT_TOKEN: envalid.str({
    desc: "Discord bot token generated on the Discord Developer Dashboard.",
  }),

  APPLICATION_ID: envalid.str({
    desc: "Client application ID generated on the Discord Developer Dashboard.",
  }),

  DEVELOPER_USER_ID: userIdValidator({
    desc: "Discord ID of the user developing/maintaining this bot.",
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

  SEASON_ID: seasonIdValidator({
    desc: "Abbreviated induction season name.",
    example: "S25",
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
