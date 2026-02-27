import { spawn } from 'node:child_process';

export async function convertToPcm16kMono(inputBuffer) {
  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error('音频数据为空');
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ac', '1',
      '-ar', '16000',
      '-f', 's16le',
      'pipe:1',
    ]);

    const stdoutChunks = [];
    const stderrChunks = [];

    ffmpeg.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    ffmpeg.on('error', (error) => {
      reject(new Error(`ffmpeg 启动失败: ${error.message}`));
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        const errText = Buffer.concat(stderrChunks).toString('utf8');
        reject(new Error(errText || `ffmpeg 转码失败 (${code})`));
        return;
      }
      resolve(Buffer.concat(stdoutChunks));
    });

    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}
