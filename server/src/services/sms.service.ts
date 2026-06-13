// ============================================================
// 智影工厂 ZhiyingWorks - 阿里云短信服务
// ============================================================

import { config } from "../config/index.js";
import { getDb, saveDatabase } from "../db/index.js";

// ============================================================
// 短信客户端（单例）— 懒加载阿里云SDK，dev模式无需安装
// ============================================================

let client: any = null;

async function getClient(): Promise<any> {
  if (!client) {
    if (!config.sms.accessKeyId || !config.sms.accessKeySecret) {
      throw new Error("短信服务未配置：缺少 AccessKey");
    }

    const [Dysmsapi20170525, $OpenApi] = await Promise.all([
      import("@alicloud/dysmsapi20170525"),
      import("@alicloud/openapi-client"),
    ]);

    const openApiConfig = new $OpenApi.Config({
      accessKeyId: config.sms.accessKeyId,
      accessKeySecret: config.sms.accessKeySecret,
    });
    openApiConfig.endpoint = "dysmsapi.aliyuncs.com";
    client = new Dysmsapi20170525.default(openApiConfig);
  }
  return client;
}

// ============================================================
// 发送验证码
// ============================================================

/** 发送短信验证码到指定手机号，返回验证码（dev模式返回） */
export async function sendSmsCode(phone: string): Promise<string> {
  const db = getDb();

  // 限流：60秒内不可重复发送（使用 SQLite datetime，时区一致）
  const recent = db.exec(
    "SELECT created_at FROM sms_codes WHERE phone = ? AND created_at > datetime('now', '-60 seconds')",
    [phone]
  );
  if (recent.length > 0 && recent[0].values.length > 0) {
    throw new SmsRateLimitError("请60秒后再试");
  }

  // 生成6位随机验证码（开发环境用固定码 123456）
  const code = config.isDev ? "123456" : String(Math.floor(100000 + Math.random() * 900000));

  // 存入数据库（过期时间由 SQLite datetime 计算，避免 JS 时区问题）
  db.run(
    "INSERT INTO sms_codes (phone, code, expires_at) VALUES (?, ?, datetime('now', '+3 minutes'))",
    [phone, code]
  );
  saveDatabase();

  // 开发环境跳过真实短信发送
  if (config.isDev) {
    console.log(`[sms] DEV MODE — 验证码: ${code} → ${phone}`);
    return code;
  }

  // 调用阿里云发送短信
  try {
    const smsClient = await getClient();
    const $Dysmsapi20170525 = await import("@alicloud/dysmsapi20170525");
    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phone,
      signName: config.sms.signName,
      templateCode: config.sms.templateCode,
      templateParam: JSON.stringify({ code }),
    });
    console.log("[sms] 发送请求:", JSON.stringify({ phone, signName: config.sms.signName, templateCode: config.sms.templateCode }));
    const response = await smsClient.sendSms(request);
    console.log("[sms] 发送响应:", JSON.stringify(response));
    
    // 检查阿里云返回的错误码
    const body = response.body || {};
    if (body.code !== 'OK') {
      console.error("[sms] 阿里云返回错误:", body.code, body.message);
      throw new Error(`阿里云短信错误: ${body.message || body.code}`);
    }
    
    console.log(`[sms] 发送成功: ${code} → ${phone}`);
    return code;
  } catch (err: any) {
    console.error("[sms] 发送失败: err.message=", err.message, "err.code=", err.code);
    if (err.body) console.error("[sms] err.body=", err.body.toString());
    throw new SmsSendError("短信发送失败，请稍后再试");
  }
}

// ============================================================
// 验证验证码
// ============================================================

/** 验证短信验证码，成功返回 true */
export function verifySmsCode(phone: string, code: string): boolean {
  const db = getDb();

  // 统一使用 SQLite datetime 判断过期，避免 JS 时区解析问题
  // 条件：未使用 + 未过期 + 最新一条
  const rows = db.exec(
    `SELECT id, code FROM sms_codes
     WHERE phone = ? AND used = 0 AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    return false;
  }

  const [id, storedCode] = rows[0].values[0] as [number, string];

  // 验证码不匹配
  if (storedCode !== code) return false;

  // 标记为已使用
  db.run("UPDATE sms_codes SET used = 1 WHERE id = ?", [id]);
  // 不在这里 saveDatabase() —— 5秒自动保存定时器会处理，避免阻塞事件循环

  return true;
}

// ============================================================
// 自定义错误类
// ============================================================

export class SmsRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsRateLimitError";
  }
}

export class SmsSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsSendError";
  }
}
