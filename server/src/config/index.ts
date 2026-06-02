// ============================================================
// AI创作聚合平台 - 配置管理
// ============================================================

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env 文件
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** 应用配置 */
export const config = {
  /** 服务端口 */
  port: parseInt(process.env.PORT || "3000", 10),

  /** 运行环境 */
  nodeEnv: process.env.NODE_ENV || "development",

  /** 数据库路径 */
  databaseUrl: process.env.DATABASE_URL || path.resolve(__dirname, "../../data/ai-creation.db"),

  /** JWT 配置 */
  jwt: {
    secret: process.env.JWT_SECRET || "dev-jwt-secret-change-in-production",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-in-production",
    accessExpiresIn: parseInt(process.env.JWT_ACCESS_EXPIRES_IN || "900", 10), // 15分钟
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || "604800", 10), // 7天
  },

  /** Redis 配置 */
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  /** API Provider 配置 */
  providers: {
    dmxapi: {
      baseUrl: process.env.DMXAPI_BASE_URL || 'https://www.dmxapi.cn/v1',
      apiKey: process.env.DMXAPI_API_KEY || '',
    },
    grsai: {
      baseUrl: process.env.GRSAI_BASE_URL || 'https://grsai.dakka.com.cn',
      apiKey: process.env.GRSAI_API_KEY || '',
    },
  },

  /** 上传目录 */
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, "../../uploads"),

  /** 是否为开发环境 */
  get isDev(): boolean {
    return this.nodeEnv === "development";
  },
} as const;

/** 确保 data 和 uploads 目录存在 */
export function ensureDirectories(): void {
  import("fs").then((fs) => {
    const dataDir = path.dirname(config.databaseUrl);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
  });
}
