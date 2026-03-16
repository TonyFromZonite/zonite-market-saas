/**
 * Create a page URL from a page name.
 * In Base44, pages were accessed by name. In our app, we use react-router paths.
 */
export function createPageUrl(pageName: string): string {
  return `/${pageName}`;
}
