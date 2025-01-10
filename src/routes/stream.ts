import { Router } from "express";
import { console } from "inspector";
import torrentStream from "torrent-stream";

const router = Router();

router.get("/api/stream", (req, res) => {
  if (!req.query.magnet || typeof req.query.magnet != "string") {
    res.status(400).json({
      err: "magnet query value is required",
    });
    return;
  }
  const magnetURI = req.query.magnet;
  const range = req.headers.range;
  const engine = torrentStream(magnetURI);

  engine.on("ready", () => {
    let contentType = "video/mp4";
    let file = engine.files.find((f) => f.name.endsWith(".mp4")); // Find the video file
    if (!file) {
      file = engine.files.find((f) => f.name.endsWith(".mkv"));
      contentType = "video/mkv";
      if (!file) {
        engine.destroy(() => {
          console.log(
            `engin for magnetURI=${magnetURI} is destroyed due the unexistance of mp4 file.`
          );
        });
        res.status(400).json({
          err: "mp4 file not found :(",
        });
        return;
      }
    }
    console.log(`Streaming file: ${file.name}`);
    if (!range) {
      // Serve the entire file if no range is specified
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": file.length,
      });
      file.createReadStream().pipe(res);
    } else {
      // Handle range requests
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;

      // Ensure range is valid
      if (start >= file.length || start > end) {
        res.writeHead(416, { "Content-Range": `bytes */${file.length}` });
        return res.end();
      }

      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${file.length}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4",
      });

      // Stream the requested range
      file.createReadStream({ start, end }).pipe(res);
    }
  });
  engine.on("error", (err: any) => {
    res.status(500).json({
      err: err,
    });
  });
  req.on("close", () => {
    engine.destroy(() => {
      console.log("request closed engine destroyed");
    });
  });
});

export default router;
