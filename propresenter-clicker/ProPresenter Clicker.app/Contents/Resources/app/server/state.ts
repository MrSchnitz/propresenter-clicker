export interface LockedPresentation {
  uuid: string;
  name: string;
  slideCount: number;
}

interface AppState {
  lockedPresentations: LockedPresentation[];
  speakerPin: string | null;
}

const state: AppState = {
  lockedPresentations: [],
  speakerPin: null,
};

export function getLockedPresentations(): LockedPresentation[] {
  return state.lockedPresentations;
}

export function setLockedPresentations(
  presentations: LockedPresentation[]
): void {
  state.lockedPresentations = presentations;
}

export function isLocked(uuid: string): boolean {
  return state.lockedPresentations.some((p) => p.uuid === uuid);
}

export function getSpeakerPin(): string | null {
  return state.speakerPin;
}

export function setSpeakerPin(pin: string | null): void {
  state.speakerPin = pin && pin.length > 0 ? pin : null;
}
