<h1 align="center">Torrent-Streamer-Api</h1>

## What can it do ?

The Torrent Streamer API is a RESTful API built with Node.js and the Express library. It allows you to search for torrents and stream videos via the HTTP protocol.

## How to run the API

install the library

```shell
npm i torrent-streamer-api
```

## How to use it ?

```js
import express from "express";
import TorrentStreamerApi from "torrent-streamer-api";

const app = express();
const PORT = 8080;

const router = TorrentStreamerApi({});

app.use(router);

let server = app.listen(PORT, () => {
  console.log(`express server is listening on port ${PORT}`);
});
```

### Search for torrents

**endpoint : GET /api/search**

queries :

- query : the search query
- category : related category
- providers : torrent providers (if not set it will be all public providers)
- limit : the limit of torrents (if not set it will be 20)

|> Note : setting an invalid provider will crash the server, this issue will be fixed soon

**example :**
request url : http://localhost:8080/search?query=any_search_query&limit=3

**response** :

```json
[
  {
    "title": "<Title>",
    "time": "Sep. 12th '19",
    "seeds": 24989,
    "peers": 9792,
    "size": "2.0 GB",
    "desc": "<Description Link>",
    "provider": "<provider>",
    "magnetURI": "magnet:?xt=urn:btih:<rest_of_uri>"
  },
  {
    "title": "<Title>",
    "time": "Sep. 12th '19",
    "seeds": 14002,
    "peers": 6486,
    "size": "1.1 GB",
    "desc": "<Description Link>",
    "provider": "<provider>",
    "magnetURI": "magnet:?xt=urn:btih:<rest_of_uri>"
  },
  {
    "title": "<Title>",
    "time": "Feb. 20th '19",
    "seeds": 12974,
    "peers": 3163,
    "size": "1.9 GB",
    "desc": "<Description Link>",
    "provider": "<provider>",
    "magnetURI": "magnet:?xt=urn:btih:<rest_of>"
  }
]
```

### How to stream

Get the magnet URI from the search response and use it to stream the video

**endpoint : GET /api/stream**

queries :

- magnet : magnet URI

**example :**

request url : http://localhost:8080/stream?magnet=magnet:?xt=urn:btih:rest_of_uri

**response :**
the server will stream the mp4 video.

## Term of use

**Please do not use this software with copyrighted or illegal content.**
