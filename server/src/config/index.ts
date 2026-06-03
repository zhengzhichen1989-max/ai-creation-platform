// ============================================================
// AI创作聚合平台 - 配置管理
// ============================================================

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env 文件 — 使用 process.cwd() 确保从 server/ 目录查找
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/** 应用配置 */
export const config = {
  /** 服务端口 */
  port: parseInt(process.env.PORT || "3000", 10),

  /** 运行环境 */
  nodeEnv: process.env.NODE_ENV || "development",

  /** 数据库路径 — 使用 process.cwd() 解析相对路径 */
  databaseUrl: process.env.DATABASE_URL || path.resolve(process.cwd(), "data/ai-creation.db"),

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

  /** 上传目录 — 使用 process.cwd() 解析相对路径，确保与 tsx CWD 一致 */
  uploadDir: process.env.UPLOAD_DIR
    ? (path.isAbsolute(process.env.UPLOAD_DIR) ? process.env.UPLOAD_DIR : path.resolve(process.cwd(), process.env.UPLOAD_DIR))
    : path.resolve(process.cwd(), "uploads"),

  /** 公网基础URL（用于将本地路径转为完整URL） */
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:3000",

  /** 微信支付V3配置 */
  wechatPay: {
    appId: process.env.WECHAT_APP_ID || '',  // 暂时为空，备案后配置
    mchId: process.env.WECHAT_MCH_ID || '1746233566',
    apiV3Key: process.env.WECHAT_API_V3_KEY || '',
    serialNo: process.env.WECHAT_SERIAL_NO || '',
    privateKey: process.env.WECHAT_PRIVATE_KEY || '',  // PEM内容，为空则从certs/目录读取文件
    notifyUrl: process.env.WECHAT_NOTIFY_URL || 'https://zhiyingworks.cn/api/v1/payment/notify',  // 备案后配置
  },

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
    // 确保参考图目录存在
    const refImagesDir = path.join(config.uploadDir, "ref_images");
    if (!fs.existsSync(refImagesDir)) {
      fs.mkdirSync(refImagesDir, { recursive: true });
    }
  });
}
