/**
 * 将媒体 URL 转为可访问地址
 * - 本地路径原样返回
 * - 外部 URL 走 /api/v1/proxy 代理，解决跨域/访问问题
 */
export function getMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/uploads/') || url.startsWith('/api/')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `/api/v1/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}
