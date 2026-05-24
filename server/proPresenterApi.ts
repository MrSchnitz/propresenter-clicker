// Dispatcher: picks WebSocket (default, for PP < 7.9) or REST (PP 7.9+) backend
// based on PROPRESENTER_PROTOCOL.

const protocol = (process.env.PROPRESENTER_PROTOCOL || "ws").toLowerCase();

const impl =
  protocol === "rest"
    ? await import("./proPresenterRestApi.js")
    : await import("./proPresenterWsApi.js");

export const getPlaylists = impl.getPlaylists;
export const getPlaylist = impl.getPlaylist;
export const getLibraries = impl.getLibraries;
export const getLibrary = impl.getLibrary;
export const getPresentation = impl.getPresentation;
export const getSlideThumb = impl.getSlideThumb;
export const triggerSlide = impl.triggerSlide;
export const triggerNext = impl.triggerNext;
export const triggerPrevious = impl.triggerPrevious;
export const getCurrentSlide = impl.getCurrentSlide;
export const getActivePresentation = impl.getActivePresentation;
