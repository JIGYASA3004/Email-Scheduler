const ADDRESS_IN_TEXT = /[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const WHOLE_ADDRESS = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/** Pulls every e-mail address out of free text / CSV content, lower-cased and de-duplicated. */
export function harvestAddresses(text: string): string[] {
  return [...new Set((text.match(ADDRESS_IN_TEXT) ?? []).map((a) => a.toLowerCase()))];
}

export const looksLikeAddress = (value: string) => WHOLE_ADDRESS.test(value.trim());
