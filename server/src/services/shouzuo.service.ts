// ============================================================
// V2 种草视频服务 - 会话管理、故事板、视频生成、文案生成
// ============================================================

import { getDb, saveDatabase } from "../db/index.js";
import { v4 as uuidv4 } from "uuid";

// --- 类型定义 ---

export interface ShouzuoSessionRow {
  id: string;
  user_id: number;
  status: string;
  current_step: string;
  uploaded_images: string; // JSON string[]
  style_id: string | null;
  style_name: string | null;
  storyboard_json: string | null; // JSON
  storyboard_frame_count: number;
  video_task_id: string | null;
  video_url: string | null;
  video_status: string | null;
  video_duration: number;
  video_thumbnail: string | null;
  video_error: string | null;
  copywriting_json: string | null; // JSON
  product_info_json: string | null; // JSON - 产品信息
  created_at: string;
  updated_at: string;
}

export interface StyleTemplate {
  id: string;
  name: string;
  description: string;
  promptPrefix: string;
}

export interface StoryboardFrame {
  index: number;
  description: string;
  imageUrl: string;
  prompt: string;
}

export interface CopywritingItem {
  index: number;
  title: string;
  body: string;
  hashtags: string[];
  platform: string;
  selected: boolean;
}

// --- 预定义风格模板 ---

const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: "forest",
    name: "森系",
    description: "自然光、植物环绕、柔和色彩，适合手工作品展示",
    promptPrefix: "in a forest setting with natural lighting, surrounded by plants and flowers, soft pastel tones, ethereal atmosphere, macro details",
  },
  {
    id: "japanese",
    name: "日系",
    description: "简约清爽、柔和光线、注重细节质感",
    promptPrefix: "Japanese minimalist aesthetic, clean composition, soft natural window light, zen atmosphere, focus on texture and craftsmanship details",
  },
  {
    id: "vintage",
    name: "复古",
    description: "暖色调、胶片质感、怀旧氛围",
    promptPrefix: "vintage film photography style, warm amber tones, grainy texture, nostalgic atmosphere, golden hour lighting, artisanal craft feel",
  },
  {
    id: "minimal",
    name: "极简",
    description: "纯色背景、几何构图、突出产品本体",
    promptPrefix: "minimalist product photography, clean solid background, geometric composition, studio lighting, sharp focus on product details, high-end commercial look",
  },
  {
    id: "mood",
    name: "氛围感",
    description: "暗调光影、情绪化表达、艺术感",
    promptPrefix: "moody cinematic lighting, dramatic shadows, artistic composition, deep rich colors, editorial photography style, emotional storytelling through visuals",
  },
];

/** 初始化 shouzuo_sessions 表 */
export function ensureShouzuoTable(): void {
  const db = getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS shouzuo_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      current_step TEXT NOT NULL DEFAULT 'upload',
      uploaded_images TEXT NOT NULL DEFAULT '[]',
      style_id TEXT,
      style_name TEXT,
      storyboard_json TEXT,
      storyboard_frame_count INTEGER DEFAULT 5,
      video_task_id TEXT,
      video_url TEXT,
      video_status TEXT,
      video_duration INTEGER DEFAULT 10,
      video_thumbnail TEXT,
      video_error TEXT,
      copywriting_json TEXT,
      product_info_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  // 兼容: 旧版本可能没有某些字段
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN style_name TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN storyboard_frame_count INTEGER DEFAULT 5"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN video_duration INTEGER DEFAULT 10"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN video_thumbnail TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN product_info_json TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN video_error TEXT"); } catch (_) { /* ignore */ }
}

/** 获取所有风格模板 */
export function getStyleTemplates(): StyleTemplate[] {
  return STYLE_TEMPLATES;
}

/** 创建种草视频会话 */
export function createSession(
  userId: number,
  imageUrls: string[],
  productInfo?: { name?: string; description?: string; sellingPoints?: string[]; price?: string; targetAudience?: string }
): ShouzuoSessionRow {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const productInfoJson = productInfo && (productInfo.name || productInfo.description || (productInfo.sellingPoints && productInfo.sellingPoints.length > 0))
    ? JSON.stringify(productInfo)
    : null;

  db.run(
    `INSERT INTO shouzuo_sessions (id, user_id, status, current_step, uploaded_images, product_info_json, created_at, updated_at)
     VALUES (?, ?, 'active', 'upload', ?, ?, ?, ?)`,
    [id, userId, JSON.stringify(imageUrls), productInfoJson, now, now]
  );

  saveDatabase();

  return getSession(id)!;
}

/** 获取会话 */
export function getSession(sessionId: string): ShouzuoSessionRow | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM shouzuo_sessions WHERE id = ?");
  stmt.bind([sessionId]);
  if (stmt.step()) {
    return stmt.getAsObject() as unknown as ShouzuoSessionRow;
  }
  return null;
}

/** 获取用户的所有会话 */
export function listSessions(userId: number, page = 1, limit = 10): { items: ShouzuoSessionRow[]; total: number } {
  const db = getDb();
  const countResult = db.exec("SELECT COUNT(*) FROM shouzuo_sessions WHERE user_id = ?", [userId]);
  const total = (countResult[0]?.values[0]?.[0] as number) ?? 0;

  const offset = (page - 1) * limit;
  const rows = db.exec(
    "SELECT * FROM shouzuo_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [userId, limit, offset]
  );

  const items: ShouzuoSessionRow[] = (rows[0]?.values ?? []).map((row: unknown[]) => ({
    id: row[0] as string,
    user_id: row[1] as number,
    status: row[2] as string,
    current_step: row[3] as string,
    uploaded_images: row[4] as string,
    style_id: row[5] as string | null,
    style_name: row[6] as string | null,
    storyboard_json: row[7] as string | null,
    storyboard_frame_count: (row[8] as number) ?? 5,
    video_task_id: row[9] as string | null,
    video_url: row[10] as string | null,
    video_status: row[11] as string | null,
    video_duration: (row[12] as number) ?? 10,
    video_thumbnail: row[13] as string | null,
    copywriting_json: row[14] as string | null,
    created_at: row[15] as string,
    updated_at: row[16] as string,
  }));

  return { items, total };
}

/** 选择风格 */
export function selectStyle(sessionId: string, styleId: string, userId: number): StyleTemplate {
  const db = getDb();
  const style = STYLE_TEMPLATES.find((s) => s.id === styleId);
  if (!style) throw new Error("风格模板不存在");

  const now = new Date().toISOString();
  db.run(
    "UPDATE shouzuo_sessions SET style_id = ?, style_name = ?, current_step = 'select_style', updated_at = ? WHERE id = ? AND user_id = ?",
    [styleId, style.name, now, sessionId, userId]
  );

  saveDatabase();
  return style;
}

/** 保存故事板 */
export function saveStoryboard(
  sessionId: string,
  userId: number,
  frames: StoryboardFrame[],
  styleName: string,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const storyboardJson = JSON.stringify({
    frames,
    totalFrames: frames.length,
    style: styleName,
    generatedAt: now,
  });

  db.run(
    "UPDATE shouzuo_sessions SET storyboard_json = ?, storyboard_frame_count = ?, current_step = 'confirm_board', updated_at = ? WHERE id = ? AND user_id = ?",
    [storyboardJson, frames.length, now, sessionId, userId]
  );

  saveDatabase();
}

/** 保存视频生成结果 */
export function saveVideoResult(
  sessionId: string,
  userId: number,
  taskId: string,
  status: string,
  url?: string,
  thumbnail?: string,
  duration?: number,
  errorMessage?: string,
): void {
  const db = getDb();
  const now = new Date().toISOString();

  if (status === "completed" && url) {
    db.run(
      "UPDATE shouzuo_sessions SET video_task_id = ?, video_url = ?, video_status = 'completed', video_thumbnail = ?, video_duration = ?, video_error = NULL, current_step = 'copywriting', updated_at = ? WHERE id = ? AND user_id = ?",
      [taskId, url, thumbnail ?? null, duration ?? 10, now, sessionId, userId]
    );
  } else if (status === "failed") {
    db.run(
      "UPDATE shouzuo_sessions SET video_task_id = ?, video_status = 'failed', video_error = ?, current_step = 'generate', updated_at = ? WHERE id = ? AND user_id = ?",
      [taskId, errorMessage ?? "视频生成失败", now, sessionId, userId]
    );
  } else {
    db.run(
      "UPDATE shouzuo_sessions SET video_task_id = ?, video_status = ?, current_step = 'generate', updated_at = ? WHERE id = ? AND user_id = ?",
      [taskId, status, now, sessionId, userId]
    );
  }

  saveDatabase();
}

/** 保存文案 */
export function saveCopywriting(
  sessionId: string,
  userId: number,
  items: CopywritingItem[],
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.run(
    "UPDATE shouzuo_sessions SET copywriting_json = ?, current_step = 'download', updated_at = ? WHERE id = ? AND user_id = ?",
    [JSON.stringify(items), now, sessionId, userId]
  );

  saveDatabase();
}
