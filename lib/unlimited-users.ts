// Developer / owner accounts that bypass the credit system entirely.
// Used during testing so Connor can run as many generations as needed
// without depleting test credits or hitting the paywall.
//
// To revoke, remove the email from this set and ship.
const UNLIMITED_EMAILS = new Set([
  // "connor@hvnsen.com",
  "connor_hansen@icloud.com",
]);

export function isUnlimitedUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return UNLIMITED_EMAILS.has(email.toLowerCase());
}
