import sharp from "sharp";
const S = 16, SCALE = 4, COLS = 10, ROWS = 8;
const sheet = process.argv[2] ?? "00";
const src = `asset/projectile/All_Fire_Bullet_Pixel_16x16_${sheet}.png`;
const comps = [];
for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
        const buf = await sharp(src).extract({ left: c*S, top: r*S, width: S, height: S })
            .resize(S*SCALE, S*SCALE, { kernel: "nearest" }).png().toBuffer();
        comps.push({ input: buf, left: c*(S*SCALE+6)+3, top: r*(S*SCALE+16)+3 });
        const svg = `<svg width="70" height="14"><text x="1" y="11" font-family="monospace" font-size="10" fill="#8ff">r${r}c${c}</text></svg>`;
        comps.push({ input: Buffer.from(svg), left: c*(S*SCALE+6)+3, top: r*(S*SCALE+16)+S*SCALE+4 });
    }
}
await sharp({ create: { width: COLS*(S*SCALE+6), height: ROWS*(S*SCALE+16), channels: 4, background: {r:24,g:24,b:34,alpha:1} } })
    .composite(comps).png().toFile(process.argv[3]);
console.log("ok", sheet);
