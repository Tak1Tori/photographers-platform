export const megabyte = 1024 * 1024;

export const avatarImageMaxBytes = 25 * megabyte;
export const albumCoverMaxBytes = 4 * megabyte;
export const albumImageMaxBytes = 25 * megabyte;
export const albumVideoMaxBytes = 200 * megabyte;
export const albumUploadMaxBytes = 240 * megabyte;
export const albumMediaMaxFiles = 20;

export function formatMegabytes(bytes: number) {
  return Math.round(bytes / megabyte);
}
