import type { ChannelId, UrlString, UserId } from "./branded.types";

declare global {
  type EnvironmentVariables = {

    // ////////////////////// //
    //      SDLC Related      //
    // ////////////////////// //

    /**
     * Environment corresponding to the current software development lifecycle
     * (SDLC) stage.
     */
    NODE_ENV: "development" | "production";

    // ///////////////////// //
    //      Bot Related      //
    // ///////////////////// //

    /**
     * Discord bot token generated on the Discord Developer Dashboard.
     */
    BOT_TOKEN: string;
    /**
     * Client application ID generated on the Discord Developer Dashboard.
     */
    APPLICATION_ID: string;

    // /////////////////// //
    //      Snowflakes     //
    // /////////////////// //

    /**
     * ID of the user developing/maintaining this bot.
     */
    DEVELOPER_USER_ID: UserId;

    // ////////////////// //
    //      Sensitive     //
    // ////////////////// //

    INDUCTION_EMAIL: string;

    // //////////////////////////// //
    //      Seasonal Constants      //
    // //////////////////////////// //

    INDUCTION_ANNOUNCEMENTS_CHANNEL_ID: ChannelId;
    INDUCTEES_CHAT_CHANNEL_ID: ChannelId;
    INDUCTEE_DATA_SPREADSHEET_ID: string;
    REQUIREMENTS_DOCUMENT_LINK: UrlString;
    PRIVATE_REQUIREMENT_TRACKER_SPREADSHEET_ID: string;
    PUBLIC_REQUIREMENT_TRACKER_SPREADSHEET_ID: string;
    /**
     * Name of MongoDB database to use.
     */
    DB_NAME: string;

    // //////////////////////////// //
    //      3rd Party Services      //
    // //////////////////////////// //

    /**
     * Connection string for MongoDB service.
     */
    DB_CONNECTION_STRING: string;
  };

  namespace NodeJS {
    interface ProcessEnv extends Readonly<EnvironmentVariables> { }
  }
}

export { };
