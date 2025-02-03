export interface TorrentMetaData {
  name: string;
  path: string;
  size: number;
  streamUrl?: string;
  /**
   * File path encoded to base 64
   */
  path64: string;
}
