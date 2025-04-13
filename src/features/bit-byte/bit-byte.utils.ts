import _ from "lodash";

import { SEASON_ID } from "../../utils/upe.utils";
import {
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
