export interface LockedPresentation {
  uuid: string;
  name: string;
  slideCount: number;
}

interface AppState {
  lockedPresentation: LockedPresentation | null;
  speakerPin: string | null;
}

const state: AppState = {
  lockedPresentation: null,
  speakerPin: null,
};

export function getLockedPresentation(): LockedPresentation | null {
  return state.lockedPresentation;
}

export function setLockedPresentation(
  presentation: LockedPresentation | null
): void {
  state.lockedPresentation = presentation;
}

export function getSpeakerPin(): string | null {
  return state.speakerPin;
}

export function setSpeakerPin(pin: string | null): void {
  state.speakerPin = pin && pin.length > 0 ? pin : null;
}
