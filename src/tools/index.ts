/**
 * Default tool wiring. The app calls `registerDefaultTools()` exactly
 * once on boot. Tests call it explicitly when they need the production
 * tool set; tests that exercise the registry's primitives reset the
 * registry between runs.
 */

import { register } from '../agent/toolRegistry';
import { calendarListTool } from './calendar';
import { gmailReadTool, gmailSendTool } from './gmail';

export const registerDefaultTools = (): void => {
  register(gmailReadTool);
  register(gmailSendTool);
  register(calendarListTool);
};

export { gmailReadTool, gmailSendTool, calendarListTool };
