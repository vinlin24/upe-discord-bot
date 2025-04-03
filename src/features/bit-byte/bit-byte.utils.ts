import { BitByteLocation, type BitByteEvent } from "./bit-byte.model";

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
