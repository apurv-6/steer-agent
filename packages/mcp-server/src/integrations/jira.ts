/**
 * Jira integration stub.
 * Parses Jira ticket IDs from task goals and provides context.
 * Graceful degradation if not configured.
 */
export async function importFrom(params: Record<string, string>): Promise<string> {
  const ticketId = params.ticketId || extractTicketId(params.goal || "");

  if (!ticketId) {
    return "No Jira ticket ID found";
  }

  const baseUrl = params.baseUrl || process.env.JIRA_BASE_URL;
  if (!baseUrl) {
    return `Jira ticket detected: ${ticketId} (Jira not configured — set JIRA_BASE_URL)`;
  }

  // Stub: in production, would fetch ticket details via Jira REST API
  return `Jira ticket: ${ticketId} (URL: ${baseUrl}/browse/${ticketId})`;
}

/**
 * Extract Jira ticket ID from text (e.g., "PROJ-123").
 */
function extractTicketId(text: string): string | null {
  const match = text.match(/\b([A-Z]{2,10}-\d+)\b/);
  return match ? match[1] : null;
}
