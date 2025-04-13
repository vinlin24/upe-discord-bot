// Discord API limits so we can look before we leap.

export const MESSAGE_CHARACTER_LIMIT = 2000;

export const AUTOCOMPLETE_MAX_CHOICES = 25;

// Ref: https://discordjs.guide/popular-topics/embeds.html#embed-limits.

export const EMBED_TITLE_LIMIT = 256;
export const EMBED_DESCRIPTION_LIMIT = 4096;
export const EMBED_FIELD_LIMIT = 25;
export const EMBED_FIELD_NAME_LIMIT = 256;
export const EMBED_FIELD_VALUE_LIMIT = 1024;
export const EMBED_FOOTER_TEXT_LIMIT = 2048;
export const EMBED_AUTHOR_NAME_LIMIT = 256;
export const EMBED_TOTAL_LIMIT = 6000;
export const EMBEDS_PER_MESSAGE_LIMIT = 10;

// Discovered empirically lol.

export const ROLE_NAME_MAX_LENGTH = 100;
