/**
 * Public surface of the guided-tour subsystem.
 * Screens import from `@/components/guide` only — never from individual files.
 */

export { GuidedTour } from './GuidedTour';
export { TourProvider } from './TourProvider';
export { useTour } from './useTour';
export { useTourPortal } from './tourPortalContext';
export {
  ALL_TOUR_IDS,
  completionKey,
  type MeasuredRect,
  type SpotlightShape,
  type TooltipPosition,
  type TourId,
  type TourStep,
} from './types';
export type { ActiveTourBinding } from './tourBindingChannel';
export type { UseTourApi } from './useTour';
export {
  buildVaultOpenAiSetupSteps,
  buildVaultGoogleConnectSteps,
  buildChatFirstMessageSteps,
  buildChatConfirmActionSteps,
  buildMailFirstOpenSteps,
  buildMailSendViaAgentSteps,
  buildCalendarFirstOpenSteps,
  buildCalendarCreateViaAgentSteps,
  buildMemoryFirstOpenSteps,
  buildSettingsFirstOpenSteps,
  buildVoiceFirstUseSteps,
} from './tours';
