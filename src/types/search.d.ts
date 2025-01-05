import torrentSearch from "torrent-search-api";

interface Torrent extends torrentSearch.Torrent {
  magnetURI: string;
}
