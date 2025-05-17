/**
 * Provides default LinkedIn cookies if needed
 */
export async function getCookies() {
  // In production, you might want to retrieve cookies from an environment variable
  const defaultCookies = process.env.LINKEDIN_COOKIES || '';
  return defaultCookies;
}