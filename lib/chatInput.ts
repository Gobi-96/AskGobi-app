/** Shared by the composer and server so the search indicator matches routing. */
export const needsWebSearch = (query: string) =>
  /\b(today|latest|recent|version|online|live|now|current|new|news|update|price|weather|trending|launch|launched|release|released|announced)\b/i.test(query);
