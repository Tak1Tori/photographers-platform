export function getCloudinaryVideoPosterUrl(url?: string | null) {
  if (!url || !url.includes("/video/upload/")) return "";

  const [prefix, rest] = url.split("/video/upload/");
  if (!prefix || !rest) return "";

  const [path] = rest.split("?");
  const withoutExtension = path.replace(/\.[a-z0-9]+$/i, "");

  return `${prefix}/video/upload/so_0,w_1280,h_720,c_fill,q_auto:good,f_jpg/${withoutExtension}.jpg`;
}
