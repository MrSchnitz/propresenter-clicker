export interface LockedPresentation {
  uuid: string;
  name: string;
  slideCount: number;
}

interface AppState {
  lockedPresentation: LockedPresentation | null;
}

const state: AppState = {
  lockedPresentation: null,
};

export function getLockedPresentation(): LockedPresentation | null {
  return state.lockedPresentation;
}

export function setLockedPresentation(
  presentation: LockedPresentation | null
): void {
  state.lockedPresentation = presentation;
}
