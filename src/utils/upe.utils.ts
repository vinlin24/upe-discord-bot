import { type ColorResolvable, type RoleResolvable } from "discord.js";
import { configDotenv } from "dotenv";

import type { RoleId, UrlString } from "../types/branded.types";
import { getEnumFromName } from "../types/generic.types";
import {
  ADVOCACY_ROLE_ID,
  ALUMNI_ROLE_ID,
  CORPORATE_ROLE_ID,
  DESIGN_AND_PUBLICITY_ROLE_ID,
  ENTREPRENEURSHIP_ROLE_ID,
  EVP_ROLE_ID,
  FINANCE_AND_FACILITIES_ROLE_ID,
  INDUCTION_AND_MEMBERSHIP_ROLE_ID,
  IVP_ROLE_ID,
  MENTORSHIP_ROLE_ID,
  PRESIDENT_ROLE_ID,
  SOCIAL_ROLE_ID,
  TUTORING_ROLE_ID,
  WEB_ROLE_ID,
} from "./snowflakes.utils";

configDotenv();

export const UPE_BLUE: ColorResolvable = "#3067d3";

export enum Committee {
  Web = "Web",
  Advocacy = "Advocacy",
  DesignAndPublicity = "Design & Publicity",
  FinanceAndFacilities = "Finance & Facilities",
  InductionAndMembership = "Induction & Membership",
  Mentorship = "Mentorship",
  Social = "Social",
  Tutoring = "Tutoring",
  Entrepreneurship = "Entrepreneurship",
  Corporate = "Corporate",
  Alumni = "Alumni",
  President = "President",
  InternalVicePresident = "Internal Vice President",
  ExternalVicePresident = "External Vice President",
}

export type CommitteeName = `${Committee}`;

export const COMMITTEE_NAMES: CommitteeName[] = Object.values(Committee);

export function getCommitteeFromName(
  name: CommitteeName,
): Committee {
  const committee = getEnumFromName(Committee, name);
  if (committee === undefined) {
    throw new Error(
      `${name} should have had a valid reverse mapping in committee enum.`,
    );
  }
  return committee;
}

export function committeeRoleToEnum(
  role: RoleResolvable,
): Committee | undefined {
  const roleId = (typeof role === "string" ? role : role.id) as RoleId;

  switch (roleId) {
    case FINANCE_AND_FACILITIES_ROLE_ID:
      return Committee.FinanceAndFacilities;
    case ADVOCACY_ROLE_ID:
      return Committee.Advocacy;
    case ALUMNI_ROLE_ID:
      return Committee.Alumni;
    case DESIGN_AND_PUBLICITY_ROLE_ID:
      return Committee.DesignAndPublicity;
    case MENTORSHIP_ROLE_ID:
      return Committee.Mentorship;
    case TUTORING_ROLE_ID:
      return Committee.Tutoring;
    case SOCIAL_ROLE_ID:
      return Committee.Social;
    case WEB_ROLE_ID:
      return Committee.Web;
    case CORPORATE_ROLE_ID:
      return Committee.Corporate;
    case INDUCTION_AND_MEMBERSHIP_ROLE_ID:
      return Committee.InductionAndMembership;
    case ENTREPRENEURSHIP_ROLE_ID:
      return Committee.Entrepreneurship;
    case PRESIDENT_ROLE_ID:
      return Committee.President;
    case IVP_ROLE_ID:
      return Committee.InternalVicePresident;
    case EVP_ROLE_ID:
      return Committee.ExternalVicePresident;
    default:
      return undefined;
  }
}

export enum TeamType {
  Exec = "Exec",
  Core = "Core",
  Internal = "Internal",
  External = "External",
};

export type TeamTypeName = `${TeamType}`;

export const TEAM_TYPE_NAMES: TeamTypeName[] = Object.values(TeamType);

export const INDUCTION_LINKTREE
  = "https://linktr.ee/upe_induction" as UrlString;
export const UPE_LINKTREE
  = "https://linktr.ee/upeucla" as UrlString;
export const UPE_WEBSITE
  = "https://upe.seas.ucla.edu" as UrlString;
export const TUTORING_SCHEDULE_WEBPAGE
  = "https://upe.seas.ucla.edu/tutoring/" as UrlString;

export const {
  INDUCTION_EMAIL,
  PUBLIC_REQUIREMENT_TRACKER_SPREADSHEET_URL,
  REQUIREMENTS_DOCUMENT_LINK,
  SEASON_ID,
} = process.env;
