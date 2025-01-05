import fs from "fs"

import parseTorrent from "parse-torrent" 



export async function parseTorrentFile(filePath) {
    fs.readFile(filePath, async(err, data) => {
        if (err) {
            console.error('Error reading torrent file:', err);
            return;
        }
        const parsed = await parseTorrent(data);
        console.log(parsed);
    });
}