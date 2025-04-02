import type { GuildId } from "./types/branded.types";

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
    /**
     * ID of the UPE server, the sole server this bot serves.
     */
    UPE_GUILD_ID: GuildId;

    // //////////////////////////// //
    //      3rd Party Services      //
    // //////////////////////////// //

    /**
     * Connection string for MongoDB service.
     */
    DB_CONNECTION_STRING: string;
    /**
     * Name of MongoDB database to use.
     */
    DB_NAME: string;
  };

  namespace NodeJS {
    interface ProcessEnv extends Readonly<EnvironmentVariables> { }
  }
}

export { };
