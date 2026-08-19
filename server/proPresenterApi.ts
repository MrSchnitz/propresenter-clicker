// Dispatcher: picks WebSocket (default, for PP < 7.9) or REST (PP 7.9+) backend
// based on PROPRESENTER_PROTOCOL. Resolved per call — not at module load — so
// the protocol can be switched at runtime from the admin settings.

import * as wsApi from "./proPresenterWsApi.js";
import * as restApi from "./proPresenterRestApi.js";

function impl() {
  const protocol = (process.env.PROPRESENTER_PROTOCOL || "ws").toLowerCase();
  return protocol === "rest" ? restApi : wsApi;
}

export const getPlaylists = () => impl().getPlaylists();
export const getPlaylist = (id: string) => impl().getPlaylist(id);
export const getLibraries = () => impl().getLibraries();
export const getLibrary = (id: string) => impl().getLibrary(id);
export const getPresentation = (uuid: string) => impl().getPresentation(uuid);
export const getSlideThumb = (
  uuid: string,
  slideIndex: number,
  quality?: number
) => impl().getSlideThumb(uuid, slideIndex, quality);
export const triggerSlide = (uuid: string, slideIndex: number) =>
  impl().triggerSlide(uuid, slideIndex);
export const clear = () => impl().clear();
export const getCurrentSlide = () => impl().getCurrentSlide();
