import { TorrentStreamerApi } from "./router.js";
export default TorrentStreamerApi;

export interface Controllers {
  /**
   * Destroys the streamer.
   */
  destroy: (cb: (err: string | Error) => void) => void;
}
