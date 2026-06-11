// ============================================================
// AI创作聚合平台 - 内容审核服务
// 双轨审核：阿里云绿网（增强版PLUS TextModerationPlus） + 本地规则兜底
// 阿里云不可用时自动降级为纯本地规则
// ============================================================

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";
import { config as appConfig } from "../config/index.js";

const require = createRequire(import.meta.url);

export interface ModerationResult {
  safe: boolean;
  reason?: string;
  matchedCategory?: string;
  matchedKeyword?: string;
}

interface KeywordRule {
  pattern: string;
  reason: string;
  category: string;
}

let keywordRules: KeywordRule[] = [];
let rulesLoaded = false;

// 阿里云 Green SDK 缓存
let GreenModule: any = null;
let aliyunClient: any = null;
let aliyunAvailable: boolean | null = null;

const LABEL_CN: Record<string, string> = {
  normal: "正常",
  porn: "色情",
  politics: "政治敏感",
  terrorism: "暴恐",
  ad: "广告",
  abuse: "辱骂",
  contraband: "违禁品",
  spam: "垃圾信息",
  flood: "灌水",
  // PLUS 增强版额外标签
  sexual_harassment: "性骚扰",
  sexual_minor: "未成年人色情",
  violence: "暴力",
  illegal: "违法",
  discrimination: "歧视",
  religion: "宗教",
  custom: "自定义违规",
};

const RISK_LEVEL_CN: Record<string, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
};

function getAliyunClient(): any | null {
  if (aliyunAvailable === false) return null;
  if (aliyunClient) return aliyunClient;

  const akId = process.env.ALIBABA_ACCESS_KEY_ID;
  const akSec = process.env.ALIBABA_ACCESS_KEY_SECRET;

  if (!akId || !akSec) {
    console.warn("[审核] 阿里云密钥未配置，仅使用本地规则");
    aliyunAvailable = false;
    return null;
  }

  try {
    GreenModule = require("@alicloud/green20220302");
    aliyunClient = new GreenModule.default({
      accessKeyId: akId,
      accessKeySecret: akSec,
      endpoint: "green.cn-shanghai.aliyuncs.com",
    });
    aliyunAvailable = true;
    console.log("[审核] ✓ 阿里云绿网已接入（增强版 PLUS — TextModerationPlus）");
  } catch (err: any) {
    console.warn("[审核] 阿里云 SDK 加载失败，降级为纯本地规则:", err?.message || err);
    aliyunAvailable = false;
    return null;
  }

  return aliyunClient;
}

async function checkPromptWithAliyun(prompt: string): Promise<ModerationResult> {
  const client = getAliyunClient();
  if (!client || !GreenModule) return { safe: true };

  try {
    // ── 增强版 PLUS：TextModerationPlus ──
    // service: llm_query_moderation = 大语言模型输入文字检测（最适合 AI 生图提示词场景）
    // 其他可选：chat_detection_pro（私聊）、llm_response_moderation（LLM输出）、
    //          aigc_moderation_byllm（AIGC场景）、ugc_moderation_byllm（UGC场景）
    const req = new GreenModule.TextModerationPlusRequest({
      service: "llm_query_moderation",
      serviceParameters: JSON.stringify({ content: prompt }),
    });

    const res = await client.textModerationPlus(req);
    const body = (res as any).body || res;

    if (body.code === 200 && body.data) {
      const data = body.data;

      // PLUS 返回 RiskLevel: high / medium / low / none
      const riskLevel: string = data.riskLevel || data.RiskLevel || "none";
      if (riskLevel === "none") return { safe: true };

      // 取置信度最高的违规标签
      const results: any[] = data.result || data.Result || [];
      const topHit = results.find((r: any) => {
        const label = (r.label || r.Label || "").toLowerCase();
        return label !== "normal" && label !== "none";
      });

      const labelKey = topHit?.["label"] || topHit?.["Label"] || "unknown";
      const confidence = topHit?.["confidence"] || topHit?.["Confidence"] || 0;
      const riskWords = topHit?.["riskWords"] || topHit?.["RiskWords"] || "";
      const labelCN = LABEL_CN[labelKey] || labelKey;
      const riskCN = RISK_LEVEL_CN[riskLevel] || riskLevel;

      console.log(
        `[审核] 拦截: 等级=${riskCN} 标签=${labelCN} 置信度=${confidence}%` +
          (riskWords ? ` 命中词=${riskWords}` : "")
      );

      return {
        safe: false,
        reason: `提示词包含违规内容（${labelCN}），请修改后重试`,
        matchedCategory: labelKey,
      };
    }

    return { safe: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    // 400 错误通常是 service 未在控制台开通
    if (msg.includes("service") || msg.includes("not support") || msg.includes("not open")) {
      console.warn("[审核] TextModerationPlus 服务未开通，降级为本地规则。提示:", msg.slice(0, 150));
      return { safe: true };
    }
    console.error("[审核] 阿里云 API 调用失败:", msg.slice(0, 200));
    return { safe: true };
  }
}

function loadKeywordRules(): void {
  if (rulesLoaded) return;

  const rulesPath =
    appConfig.contentModerationRulesPath ||
    resolve(process.cwd(), "server/config/moderation-rules.json");

  try {
    if (existsSync(rulesPath)) {
      const raw = readFileSync(rulesPath, "utf-8");
      const parsed = JSON.parse(raw);
      keywordRules = (parsed as any).rules || [];
      console.log(`[审核] ✓ 已加载 ${keywordRules.length} 条本地审核规则`);
    } else {
      console.warn("[审核] 规则文件不存在，仅有阿里云防护");
      keywordRules = [];
    }
  } catch (err) {
    console.error("[审核] 规则加载失败:", err instanceof Error ? err.message : err);
    keywordRules = [];
  }

  rulesLoaded = true;
}

export async function checkPrompt(prompt: string): Promise<ModerationResult> {
  loadKeywordRules();

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return { safe: true };
  }

  const cleanPrompt = prompt.trim();

  // 第一道：阿里云绿网
  const aliyunResult = await checkPromptWithAliyun(cleanPrompt);
  if (!aliyunResult.safe) return aliyunResult;

  // 第二道：本地规则
  for (const rule of keywordRules) {
    try {
      const regex = new RegExp(rule.pattern, "i");
      if (regex.test(cleanPrompt)) {
        return {
          safe: false,
          reason: rule.reason,
          matchedCategory: rule.category,
        };
      }
    } catch (err) {
      console.error(`[审核] 正则错误: ${rule.pattern}`);
    }
  }

  return { safe: true };
}

export async function checkPrompts(prompts: string[]): Promise<ModerationResult[]> {
  return Promise.all(prompts.map((p) => checkPrompt(p)));
}

export async function assertPromptSafe(prompt: string): Promise<void> {
  const result = await checkPrompt(prompt);
  if (!result.safe) {
    throw Object.assign(new Error(result.reason || "内容不符合安全规范"), {
      statusCode: 400,
      errorCode: "CONTENT_MODERATION_FAILED",
      moderationResult: result,
    });
  }
}

export function reloadRules(): void {
  rulesLoaded = false;
  keywordRules = [];
  loadKeywordRules();
}
