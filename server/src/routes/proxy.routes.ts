// ============================================================
// 媒体代理路由 - 为外部图片/视频 URL 提供同源代理
// 仅允许已登录用户访问，防止滥用
// ============================================================

import type { FastifyInstance } from "fastify";

const ALLOWED_DOMAINS = [
  "grsai.dakka.com.cn",
  "grsai.dakka.com",
  "aitohumanize.com",
  "cdn.dmxapi.com",
  "dmxapi.cn",
  "dmxapi.com",
  "volces.com",
  "tos-cn-beijing.volces.com",
  "ark-acg-cn-beijing.tos-cn-beijing.volces.com",
];

export async function proxyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const url = query.url;

    if (!url) {
      return reply.status(400).send({ code: 400, message: "缺少 url 参数" });
    }

    // 本地路径直接拒绝（不应走到代理）
    if (url.startsWith("/uploads/") || url.startsWith("/")) {
      return reply.status(400).send({ code: 400, message: "本地路径无需代理" });
    }

    // 只允许特定域名
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return reply.status(400).send({ code: 400, message: "无效的 URL" });
    }

    const isAllowed = ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d));
    if (!isAllowed) {
      return reply.status(403).send({ code: 403, message: "该域名不允许代理" });
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) {
        return reply.status(502).send({ code: 502, message: `上游返回 ${response.status}` });
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const buffer = Buffer.from(await response.arrayBuffer());

      reply.header("Content-Type", contentType);
      reply.header("Cache-Control", "public, max-age=3600");
      return reply.send(buffer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "代理请求失败";
      return reply.status(502).send({ code: 502, message: msg });
    }
  });
}
