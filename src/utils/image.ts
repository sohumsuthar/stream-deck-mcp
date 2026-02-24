import sharp from "sharp";

export async function renderText(
  text: string,
  width: number,
  height: number,
  options?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  }
): Promise<Buffer> {
  const fontSize = options?.fontSize ?? Math.floor(width / 5);
  const color = options?.color ?? "white";
  const bg = options?.backgroundColor ?? "black";

  // Escape XML special chars
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bg}"/>
      <text
        x="50%" y="50%"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="sans-serif"
        font-size="${fontSize}"
        fill="${color}"
        font-weight="bold"
      >${escaped}</text>
    </svg>`;

  return sharp(Buffer.from(svg))
    .resize(width, height)
    .raw()
    .toBuffer();
}

export async function loadImage(
  source: string,
  width: number,
  height: number
): Promise<Buffer> {
  let input: Buffer;

  if (source.startsWith("data:")) {
    // base64 data URI
    const base64 = source.split(",")[1];
    if (!base64) throw new Error("Invalid data URI");
    input = Buffer.from(base64, "base64");
  } else if (source.startsWith("http://") || source.startsWith("https://")) {
    const response = await fetch(source);
    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.status}`);
    input = Buffer.from(await response.arrayBuffer());
  } else {
    // Treat as raw base64
    input = Buffer.from(source, "base64");
  }

  return sharp(input)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .raw()
    .toBuffer();
}
