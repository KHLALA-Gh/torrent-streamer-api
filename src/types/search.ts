import torrentSearch from "torrent-search-api";

export interface Torrent extends torrentSearch.Torrent {
  magnetURI: string;
}
