import { Collection, GuildMember } from "discord.js";
import _ from "lodash";

import {
  BitByteEvent,
  BitByteGroup,
  BitByteGroupModel,
  BitByteLocation,
} from "../models/bit-byte.model";
import type { RoleId } from "../types/branded.types";
import { SEASON_ID } from "../utils/upe.utils";

// TODO: A lot of controllers under features/bit-byte/ still manipulate the
// BitByteGroupModel directly. To keep layers clean and separate, we should have
// them go through this service instead.
export class BitByteService {
  public static readonly CATEGORY_NAME = `Bit-Byte ${SEASON_ID}`;

  public calculateBitByteEventPoints(event: BitByteEvent): number {
    let distanceMultiplier: number;
    switch (event.location) {
      case BitByteLocation.OnCampus:
        distanceMultiplier = 1;
        break;
      case BitByteLocation.Westwood:
        distanceMultiplier = 1.25;
        break
      case BitByteLocation.LA:
        distanceMultiplier = 1.75;
        break;
    }

    const participationRatio = event.numAttended / Math.max(1, event.numTotal);
    return Math.ceil(100 * participationRatio * distanceMultiplier);
  }

  public calculateBitByteGroupPoints(group: BitByteGroup): number {
    const points = group.events.map(
      event => this.calculateBitByteEventPoints(event),
    );
    return _.sum(points);
  }

  public async getActiveGroup(
    roleId: RoleId,
  ): Promise<BitByteGroup | null> {
    const group = await BitByteGroupModel.findOne({ roleId });
    if (group === null || group.deleted) {
      return null;
    }
    return group;
  }

  public async getAllActiveGroups(): Promise<Collection<RoleId, BitByteGroup>> {
    const groups = await BitByteGroupModel.find({});
    const result = new Collection<RoleId, BitByteGroup>();
    for (const group of groups) {
      if (group.deleted) {
        continue;
      }
      result.set(group.roleId, group);
    }
    return result;
  }

  public async determineGroup(
    member: GuildMember,
  ): Promise<BitByteGroup | null> {
    for (const [roleId, group] of await this.getAllActiveGroups()) {
      const groupRole = member.roles.cache.get(roleId);
      if (groupRole !== undefined) {
        return group;
      }
    }
    return null;
  }
}

export default new BitByteService();
