import { Button } from '../types/commandTypes.ts';
import { gameSelectionButton } from './event-creation/step1-gameSelection.ts';
import { createCustomEventButton } from './event-creation/step1a-openCustomModal.ts';
import { verifyCustomEventButton } from './event-creation/step1b-verifyCustomActivity.ts';
import { finalizeEventButton } from './event-creation/step2-finalize.ts';
import { createEventButton } from './event-creation/step3-createEvent.ts';

export const buttons: Array<Button> = [gameSelectionButton, createCustomEventButton, verifyCustomEventButton, finalizeEventButton, createEventButton];
