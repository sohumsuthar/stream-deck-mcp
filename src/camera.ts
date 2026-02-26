/**
 * Camera clip module using ffmpeg.
 * Continuously records from webcam (DJI Osmo Action 5 Pro) at 1080p 60fps
 * into rolling 10-second segments. On clip, merges last 90 seconds into one file.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEVICE_NAME = "OsmoAction5pro";
const BUFFER_SECONDS = 90;
const SEGMENT_SECONDS = 10;
const SEGMENT_COUNT = Math.ceil(BUFFER_SECONDS / SEGMENT_SECONDS); // 9 segments
const CLIPS_DIR = "S:\\dji-cam-clips";
const TEMP_DIR = path.join(os.tmpdir(), "cam-buffer");

let ffmpegProcess: ChildProcess | null = null;
let startedAt: number | null = null;

export function isBuffering(): boolean {
  return ffmpegProcess !== null;
}

export function getStatus(): { buffering: boolean; seconds: number; segments: number } {
  const uptime = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  let segCount = 0;
  try {
    segCount = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith("seg_") && f.endsWith(".mp4")).length;
  } catch {}
  return {
    buffering: isBuffering(),
    seconds: Math.min(uptime, BUFFER_SECONDS),
    segments: segCount,
  };
}

/** Start the continuous background recording into rolling segments. */
export function startBuffering(): { ok: boolean; error?: string } {
  if (ffmpegProcess) {
    return { ok: true }; // already running
  }

  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(CLIPS_DIR, { recursive: true });

  // Clean old segments
  for (const f of fs.readdirSync(TEMP_DIR)) {
    if (f.startsWith("seg_")) fs.unlinkSync(path.join(TEMP_DIR, f));
  }

  const segPattern = path.join(TEMP_DIR, "seg_%03d.mp4");

  const args = [
    "-f", "dshow",
    "-video_size", "1920x1080",
    "-vcodec", "mjpeg",
    "-rtbufsize", "512M",
    "-i", `video=${DEVICE_NAME}`,
    "-r", "60",
    "-c:v", "h264_nvenc",
    "-preset", "p4",
    "-rc", "constqp",
    "-qp", "20",
    "-f", "segment",
    "-segment_time", String(SEGMENT_SECONDS),
    "-segment_wrap", String(SEGMENT_COUNT),
    "-reset_timestamps", "1",
    "-y",
    segPattern,
  ];

  try {
    ffmpegProcess = spawn("ffmpeg", args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    startedAt = Date.now();

    ffmpegProcess.on("error", (err) => {
      console.error(`cam-buffer ffmpeg error: ${err.message}`);
      ffmpegProcess = null;
      startedAt = null;
    });

    ffmpegProcess.on("exit", (code) => {
      console.log(`cam-buffer ffmpeg exited: ${code}`);
      ffmpegProcess = null;
      startedAt = null;
    });

    ffmpegProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg && !msg.startsWith("frame=")) console.error(`cam: ${msg}`);
    });

    return { ok: true };
  } catch (err) {
    ffmpegProcess = null;
    startedAt = null;
    return { ok: false, error: String(err) };
  }
}

/** Save the last ~90 seconds of buffered video as a clip. */
export function saveClip(): { ok: boolean; file?: string; error?: string } {
  // Get all segment files sorted by modification time (oldest first)
  let segments: { name: string; mtime: number }[];
  try {
    segments = fs
      .readdirSync(TEMP_DIR)
      .filter((f) => f.startsWith("seg_") && f.endsWith(".mp4"))
      .map((f) => ({
        name: f,
        mtime: fs.statSync(path.join(TEMP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => a.mtime - b.mtime);
  } catch {
    return { ok: false, error: "No segments found. Is the buffer running?" };
  }

  if (segments.length === 0) {
    return { ok: false, error: "No segments yet. Wait a few seconds." };
  }

  // Write concat list
  const concatFile = path.join(TEMP_DIR, "concat.txt");
  const lines = segments.map((s) => `file '${path.join(TEMP_DIR, s.name).replace(/\\/g, "/")}'`);
  fs.writeFileSync(concatFile, lines.join("\n"));

  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const outputFile = path.join(CLIPS_DIR, `cam_${ts}.mp4`);

  try {
    execSync(
      `ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy -movflags +faststart -y "${outputFile}"`,
      { windowsHide: true, timeout: 30000, stdio: "pipe" }
    );
    const stat = fs.statSync(outputFile);
    console.log(`cam clip: ${outputFile} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
    return { ok: true, file: outputFile };
  } catch (err) {
    return { ok: false, error: `concat failed: ${err}` };
  }
}

/** Stop the background buffer. */
export function stopBuffering(): void {
  if (!ffmpegProcess) return;
  try {
    ffmpegProcess.stdin?.write("q");
    ffmpegProcess.stdin?.end();
  } catch {
    ffmpegProcess.kill("SIGTERM");
  }
  ffmpegProcess = null;
  startedAt = null;
}
