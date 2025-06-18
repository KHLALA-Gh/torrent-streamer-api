export interface TorrentFileMetaData {
  name: string;
  path: string;
  size: number;
  streamUrl?: string;
  /**
   * File path encoded to base 64
   */
  path64: string;
}

export interface TorrentFile {
  id: string;
  name: string;
  path: string;
  size: number;
  torrentHash: string;
  progress?: number;
  downloaded?: boolean;
  streamUrl?: string;
}

export interface Stream {
  id: string;
  name: string;
  path: string;
  size: number;
  hash: string;
  preStream?: boolean;
}
