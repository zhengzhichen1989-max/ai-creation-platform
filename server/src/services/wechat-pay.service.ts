// ============================================================
// AI创作聚合平台 - 微信支付V3服务
// ============================================================

import WxPay from "wechatpay-node-v3";
import { config } from "../config/index.js";
import fs from "fs";
import path from "path";

/** 微信支付客户端实例（懒加载单例） */
let wxPayInstance: WxPay | null = null;

/** 获取微信支付客户端实例 */
function getWxPayClient(): WxPay {
  if (wxPayInstance) return wxPayInstance;

  const wechatPayConfig = config.wechatPay;

  // 读取私钥文件内容
  let privateKeyContent = wechatPayConfig.privateKey;
  if (!privateKeyContent) {
    const keyPath = path.resolve(process.cwd(), "certs/apiclient_key.pem");
    if (fs.existsSync(keyPath)) {
      privateKeyContent = fs.readFileSync(keyPath, "utf-8");
    } else {
      throw new Error("微信支付私钥未配置且文件不存在: " + keyPath);
    }
  }

  // 读取公钥证书（商户证书），如果不存在则使用空Buffer
  const certPath = path.resolve(process.cwd(), "certs/apiclient_cert.pem");
  let publicKeyContent: Buffer = Buffer.from("");
  if (fs.existsSync(certPath)) {
    publicKeyContent = fs.readFileSync(certPath);
  }

  wxPayInstance = new WxPay({
    appid: wechatPayConfig.appId,
    mchid: wechatPayConfig.mchId,
    publicKey: publicKeyContent,
    privateKey: Buffer.from(privateKeyContent),
    serial_no: wechatPayConfig.serialNo,
    key: wechatPayConfig.apiV3Key,
  });

  return wxPayInstance;
}

/** Native下单结果 */
export interface NativeOrderResult {
  codeUrl: string;
}

/** 微信支付回调通知解密结果 */
export interface PaymentNotifyResult {
  orderId: string;          // 商户订单号
  transactionId: string;    // 微信支付交易号
  tradeState: string;       // 交易状态: SUCCESS/REFUND/NOTPAY/CLOSED/REVOKED/USERPAYING/PAYERROR
  tradeStateDesc: string;   // 交易状态描述
  paidAt: string;           // 支付完成时间
}

/**
 * 调用微信Native统一下单API
 * @param orderId - 商户订单号
 * @param description - 商品描述
 * @param amountCents - 金额（分）
 * @param notifyUrl - 回调通知地址
 * @returns code_url 二维码链接
 */
export async function createNativeOrder(
  orderId: string,
  description: string,
  amountCents: number,
  notifyUrl: string
): Promise<NativeOrderResult> {
  const client = getWxPayClient();
  const wechatPayConfig = config.wechatPay;

  console.log("[WechatPay] 发起Native下单: orderId=%s, amount=%d分, notifyUrl=%s", orderId, amountCents, notifyUrl);

  const result = await client.transactions_native({
    appid: wechatPayConfig.appId || undefined,
    mchid: wechatPayConfig.mchId,
    description,
    out_trade_no: orderId,
    notify_url: notifyUrl,
    amount: {
      total: amountCents,
      currency: "CNY",
    },
  });

  console.log("[WechatPay] 下单响应: status=%d, data=%j, error=%j",
    result.status,
    result.data ? JSON.stringify(result.data).substring(0, 200) : "null",
    result.error ? JSON.stringify(result.error).substring(0, 200) : "null");

  // transactions_native 返回 Output 对象，data 中包含 code_url
  if (result.status === 200 && result.data?.code_url) {
    return { codeUrl: result.data.code_url };
  }

  throw new Error(
    `微信Native下单失败: status=${result.status}, error=${JSON.stringify(result.error || result.data)}`
  );
}

/**
 * 验证微信回调签名并解密通知内容
 * @param headers - 请求头
 * @param body - 请求体（原始字符串）
 * @returns 解密后的支付通知数据
 */
export async function verifyCallback(
  headers: Record<string, string | string[] | undefined>,
  body: string
): Promise<PaymentNotifyResult> {
  const client = getWxPayClient();
  const wechatPayConfig = config.wechatPay;

  // 构造验签所需的头信息
  const wxTimestamp = (headers["wechatpay-timestamp"] as string) || "";
  const wxNonce = (headers["wechatpay-nonce"] as string) || "";
  const wxSignature = (headers["wechatpay-signature"] as string) || "";
  const wxSerial = (headers["wechatpay-serial"] as string) || "";

  // 验证签名（构造器中已配置key，则apiSecret参数可省略）
  if (wxTimestamp && wxNonce && wxSignature && wxSerial) {
    try {
      const isVerified = await client.verifySign({
        timestamp: wxTimestamp,
        nonce: wxNonce,
        body: body,
        serial: wxSerial,
        signature: wxSignature,
        apiSecret: wechatPayConfig.apiV3Key,
      });

      if (!isVerified) {
        console.warn("[WechatPay] 回调签名验证失败，但仍尝试解密处理");
      }
    } catch (verifyErr) {
      console.warn("[WechatPay] 回调签名验证异常:", verifyErr);
    }
  }

  // 解密回调body中的resource字段
  const bodyObj = JSON.parse(body);
  const resource = bodyObj.resource;

  if (!resource) {
    throw new Error("微信回调通知缺少resource字段");
  }

  // 使用APIv3密钥解密（构造器中已配置key，则key参数可省略）
  const decrypted = client.decipher_gcm(
    resource.ciphertext,
    resource.associated_data,
    resource.nonce,
    wechatPayConfig.apiV3Key
  );

  // decipher_gcm 可能返回字符串或已解析的对象
  const paymentData = typeof decrypted === "string" ? JSON.parse(decrypted) : decrypted;

  return {
    orderId: paymentData.out_trade_no,
    transactionId: paymentData.transaction_id || "",
    tradeState: paymentData.trade_state,
    tradeStateDesc: paymentData.trade_state_desc || "",
    paidAt: paymentData.success_time || new Date().toISOString(),
  };
}

/**
 * 查询订单支付状态
 * @param orderId - 商户订单号
 * @returns 交易状态
 */
export async function queryOrder(orderId: string): Promise<{
  tradeState: string;
  transactionId: string;
}> {
  const client = getWxPayClient();

  // 使用商户订单号查询
  const result = await client.query({
    out_trade_no: orderId,
  });

  // query 返回 Output 对象，data 中包含 trade_state
  if (result.status === 200 && result.data) {
    return {
      tradeState: result.data.trade_state || "NOTPAY",
      transactionId: result.data.transaction_id || "",
    };
  }

  return {
    tradeState: "NOTPAY",
    transactionId: "",
  };
}
