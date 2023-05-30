import type { IEvent } from "../schemas/byte";

export const getEventPoints = (event: IEvent, totalBytes: number): number => {
  const { location, caption, num_mems } = event;
  if (location == "Jeopardy") {
    return parseInt(caption)
  } 

  let distanceMap = new Map<string, number>([
    ["campus", 1],
    ["westwood", 1.25],
    ["la", 1.75],
  ]);

  return Math.ceil(100 * (num_mems / totalBytes) * distanceMap.get(location)!);
};
