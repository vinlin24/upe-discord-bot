import {
  Events,
  type Awaitable,
  type Client,
  type ClientEvents,
  type GuildMember,
} from "discord.js";
import { z } from "zod";
import {
  GoogleSheetsService,
  initGoogleSheetsClient,
  loadServiceAccountCredentials
} from "../services/sheets.service";
import { INDUCTEES_ROLE_ID } from "../utils/snowflakes.utils";

export abstract class DiscordEventListener<Event extends keyof ClientEvents> {
  public abstract readonly event: Event;
  public readonly once = false;
  public readonly id = this.constructor.name;

  public abstract execute(...args: ClientEvents[Event]): Awaitable<void>;

  public handleError(error: Error): void {
    console.error(
      `${error.name} in event listener ${this.id}: ${error.message}`,
    );
  }

  public register(client: Client): void {
    const executor = async (...args: ClientEvents[Event]) => {
      try {
        await this.execute(...args);
      }
      catch (error) {
        if (error instanceof Error) {
          this.handleError(error);
        }
        else {
          throw error;
        }
      }
    }

    if (this.once) {
      client.once(this.event, executor);
    }
    else {
      client.on(this.event, executor);
    }
    console.log(`Registered ${this.event} listener ${this.id}`);
  }
}

// TODO: Is there a less brittle way of modeling the response row?
const HoursSignupFormResponseRowSchema = z.tuple([
  // [0] timestamp
  z.string(),
  // [1] emailAddress
  z.string().email(),
  // [2] firstName
  z.string(),
  // [3] lastName
  z.string(),
  // [4] firstTimeSlot
  z.string(),
  // [5] secondTimeSlot
  z.string(),
  // [6] thirdTimeSlot
  z.string(),
  // [7] inducteeOrTutor
  z.literal("Fall 2024 Inductee").or(z.literal("UPE Tutor Program")),
  // [8] discordUsername
  z.string(),
  // [9] extraInfo (optional)
]);

type HoursSignupFormResponseRow =
  z.infer<typeof HoursSignupFormResponseRowSchema>;

// TODO: Is there a less brittle way of configuring these constants?
const GOOGLE_CREDENTIALS_PATH = "google-credentials.json";
const GOOGLE_INDUCTEE_DATA_SPREADSHEET_ID = "14zb0cHd7HAz5q9M-OMizi1gboEKEDI1uZlDTM1ZJuOc";
const GOOGLE_INDUCTEE_DATA_SHEET_NAME = "Form Responses 1";

type InducteeData = {
  discordUsername: string;
  firstName: string;
  lastName: string;
}

export class InducteeJoinListener
  extends DiscordEventListener<Events.GuildMemberAdd> {

  public override readonly event = Events.GuildMemberAdd;

  private sheetsService: GoogleSheetsService;
  private inducteesCache: Map<string, InducteeData>;

  public constructor() {
    super();
    this.sheetsService = this.makeGoogleSheetsService();
    this.inducteesCache = new Map();
  }

  public override async execute(member: GuildMember): Promise<void> {
    const { username } = member.user;
    // TODO: Proper logging.
    console.log(`User ${username} joined.`);

    let inducteeData = this.inducteesCache.get(username);
    if (inducteeData !== undefined) {
      console.log(`${username} found in inductees cache, updating member.`);
      await this.updateInducteeMember(member, inducteeData);
      return;
    }

    console.log(`${username} not found in inductees cache, updating cache.`);
    await this.updateUsernamesCache();

    inducteeData = this.inducteesCache.get(username);
    if (inducteeData !== undefined) {
      console.log(
        `${username} found in updated inductees cache, updating member.`,
      );
      await this.updateInducteeMember(member, inducteeData);
      return;
    }
    console.log(
      `${username} not found in updated inductees cache, ` +
      "assuming not an inductee.",
    );
  }

  private async updateUsernamesCache(): Promise<void> {
    const inducteesSheetData = await this.sheetsService.getValues(
      GOOGLE_INDUCTEE_DATA_SHEET_NAME,
    );

    if (inducteesSheetData === null) {
      console.error("Failed to read inductee data.");
      return;
    }

    for (let rowIndex = 1; rowIndex < inducteesSheetData.length; rowIndex++) {
      const row: any[] = inducteesSheetData[rowIndex];
      let validatedRow: HoursSignupFormResponseRow;
      try {
        validatedRow = HoursSignupFormResponseRowSchema.parse(row);
      }
      catch (error) {
        if (error instanceof z.ZodError) {
          console.error(
            `Error validating inductee response data (row ${rowIndex + 1}): ` +
            error.message,
          );
          continue;
        }
        throw error;
      }

      const inducteeOrTutor = validatedRow[7];
      if (inducteeOrTutor !== "Fall 2024 Inductee") {
        continue;
      }
      const firstName = validatedRow[2];
      const lastName = validatedRow[3];
      const discordUsername = validatedRow[8];
      const inducteeData: InducteeData = {
        discordUsername,
        firstName,
        lastName,
      }
      this.inducteesCache.set(discordUsername, inducteeData);
    }
  }

  private async updateInducteeMember(
    member: GuildMember,
    inducteeData: InducteeData,
  ): Promise<void> {
    await member.roles.add(INDUCTEES_ROLE_ID);
    const nickname = `${inducteeData.firstName} ${inducteeData.lastName}`;
    await member.setNickname(nickname);
  }

  private makeGoogleSheetsService(): GoogleSheetsService {
    const credentials = loadServiceAccountCredentials(GOOGLE_CREDENTIALS_PATH);
    const client = initGoogleSheetsClient(
      credentials.client_email,
      credentials.private_key,
    );
    return new GoogleSheetsService(client, GOOGLE_INDUCTEE_DATA_SPREADSHEET_ID);
  }
}
