import { Collection } from "discord.js";
import _ from "lodash";

import type { RoleId } from "../../types/branded.types";
import { SEASON_ID } from "../../utils/upe.utils";
import {
  BitByteGroupModel,
  BitByteLocation,
  type BitByteEvent,
  type BitByteGroup,
} from "./bit-byte.model";

export const BIT_BYTE_CATEGORY_NAME = `Bit-Byte ${SEASON_ID}`;

export function calculateBitByteEventPoints(event: BitByteEvent): number {
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

export function calculateBitByteGroupPoints(group: BitByteGroup): number {
  return _.sum(group.events.map(calculateBitByteEventPoints));
}

export async function getActiveGroup(
  roleId: RoleId,
): Promise<BitByteGroup | null> {
  const group = await BitByteGroupModel.findOne({ roleId });
  if (group === null || group.deleted) {
    return null;
  }
  return group;
}

export async function getAllActiveGroups()
  : Promise<Collection<RoleId, BitByteGroup>> {
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
