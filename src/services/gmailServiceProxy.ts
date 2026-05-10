/**
 * Domain-named re-export of the Gmail subset of googleService.
 *
 * The agent-side tools (`src/tools/gmail.ts`) and the Mail screen's
 * hook (`src/hooks/useMail.ts`) both want a "gmailService"-shaped
 * import surface for clarity. Rather than split the underlying service
 * into separate files (which would force apiClient state to be
 * shared via a side-channel), we keep one googleService.ts and
 * re-export its Gmail bits here.
 *
 * Renaming this module is safe — it has no logic, only re-exports.
 */

export {
  listGmailMessages,
  searchGmailMessages,
  getGmailMessage,
  sendGmailMessage,
  buildRfc2822,
  buildGmailRawPayload,
} from './googleService';
