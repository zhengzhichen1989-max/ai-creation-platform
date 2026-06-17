// ============================================================
// 玩具AI视频生成器 - 服务层 V1.0
// ============================================================

import { getDb } from '../db/index.js';
import { config } from '../config/index.js';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

/** OpenAI 客户端（用于 GPT-4o Vision） */
const openai = new OpenAI({
  apiKey: config.openaiApiKey || 'sk-demo',
  baseURL: config.openaiBaseURL,
});

/** 支持的内容套路 */
export const CONTENT_TEMPLATES = {
  // 电动玩具 × 3 模板
  'electric-functional': {
    name: '产品功能展示',
    category: 'electric',
    duration: 15,
    shots: [
      { seq: 1, seconds: 3, desc: '产品全景白底图，缓慢推近' },
      { seq: 2, seconds: 3, desc: '产品正面特写，眼睛亮灯、耳朵动' },
      { seq: 3, seconds: 3, desc: '产品侧面 + 配件展示，旋转展示' },
      { seq: 4, seconds: 3, desc: '孩子玩耍实拍感，模仿真实使用' },
      { seq: 5, seconds: 3, desc: '产品 logo + 价格锚点，静止收尾' },
    ],
  },
  'electric-lifestyle': {
    name: '场景化种草',
    category: 'electric',
    duration: 15,
    shots: [
      { seq: 1, seconds: 4, desc: '客厅一角，孩子独自玩，自然生活感' },
      { seq: 2, seconds: 4, desc: '产品跟孩子互动，真实反应' },
      { seq: 3, seconds: 4, desc: '孩子跑向妈妈展示，真实生活感' },
      { seq: 4, seconds: 3, desc: '妈妈微笑特写，静止' },
      { seq: 5, seconds: 3, desc: '产品 + 购买信息，静止' },
    ],
  },
  'electric-comparison': {
    name: '对比测评',
    category: 'electric',
    duration: 30,
    shots: [
      { seq: 1, seconds: 5, desc: '普通款 + 我家款并列，左右分屏' },
      { seq: 2, seconds: 5, desc: '普通款细节，缓慢展示' },
      { seq: 3, seconds: 5, desc: '我家款细节，缓慢展示' },
      { seq: 4, seconds: 5, desc: '玩法对比，真实演示' },
      { seq: 5, seconds: 5, desc: '电池/续航对比，实物展示' },
      { seq: 6, seconds: 5, desc: '价格 + 工厂信息，静止' },
    ],
  },
  // 积木/拼搭 × 3 模板
  'building-functional': {
    name: '产品功能展示',
    category: 'building',
    duration: 30,
    shots: [
      { seq: 1, seconds: 5, desc: '积木盒外观白底，缓慢旋转' },
      { seq: 2, seconds: 5, desc: '颗粒细节特写，微距推近' },
      { seq: 3, seconds: 5, desc: '拼搭过程（延时），快进' },
      { seq: 4, seconds: 5, desc: '成品展示 360°，旋转' },
      { seq: 5, seconds: 5, desc: '多套组合，切换展示' },
      { seq: 6, seconds: 5, desc: '工厂信息，静止' },
    ],
  },
  'building-parent-child': {
    name: '亲子互动场景',
    category: 'building',
    duration: 30,
    shots: [
      { seq: 1, seconds: 5, desc: '爸爸和孩子桌前，自然生活感' },
      { seq: 2, seconds: 5, desc: '爸爸演示拼搭，真实过程' },
      { seq: 3, seconds: 8, desc: '孩子专注特写，微距表情' },
      { seq: 4, seconds: 5, desc: '成品完成后击掌，真实反应' },
      { seq: 5, seconds: 5, desc: '客厅+成品展示，拉远' },
      { seq: 6, seconds: 5, desc: '购买信息，静止' },
    ],
  },
  'building-educational': {
    name: '教育价值讲解',
    category: 'building',
    duration: 30,
    shots: [
      { seq: 1, seconds: 5, desc: '孩子困惑表情，静止' },
      { seq: 2, seconds: 5, desc: '孩子玩积木，真实过程' },
      { seq: 3, seconds: 8, desc: '积木从简到难，切换展示' },
      { seq: 4, seconds: 5, desc: '孩子完成作品，真实反应' },
      { seq: 5, seconds: 5, desc: '家长认可，静止' },
      { seq: 6, seconds: 5, desc: '工厂信息，静止' },
    ],
  },
};

/** 支持的语言 */
export const SUPPORTED_LANGUAGES = ['zh', 'en', 'es'];

/** 支持的尺寸 */
export const SUPPORTED_SIZES = [
  { value: '1:1', width: 1080, height: 1080, label: '1:1 (1080×1080)' },
  { value: '9:16', width: 1080, height: 1920, label: '9:16 (1080×1920)' },
];

/** 分析产品图片（GPT-4o Vision） */
export async function analyzeProductImage(imageUrl: string): Promise<{
  category: string;
  material: string;
  gameplay: string;
  ageRange: string;
  visualStyle: string;
  keywords: string[];
}> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `分析这张玩具产品图片，输出JSON：
{
  "category": "电动玩具|积木|拼搭|毛绒玩具|益智早教",
  "material": "材质描述",
  "gameplay": "玩法描述",
  "ageRange": "适用年龄",
  "visualStyle": "视觉风格",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

只返回JSON，不要其他文字。` },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || '{}');
  } catch (error) {
    console.error('[ToyVideo] 图片分析失败:', error);
    throw new Error('图片分析失败，请重试');
  }
}

/** 生成故事板（分镜脚本） */
export async function generateStoryboard(params: {
  templateId: string;
  productInfo: {
    name: string;
    category: string;
    material: string;
    gameplay: string;
    ageRange: string;
    sellingPoints: string[];
  };
  language: string;
}): Promise<{
  shots: Array<{
    seq: number;
    seconds: number;
    imagePrompt: string;
    voiceover: string;
    subtitles: string;
  }>;
}> {
  const template = CONTENT_TEMPLATES[params.templateId];
  if (!template) throw new Error('模板不存在');

  const langMap = { zh: '中文', en: 'English', es: 'Español' };
  const targetLang = langMap[params.language] || '中文';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `你是一个专业的玩具视频脚本编剧。

产品信息：
- 名称：${params.productInfo.name}
- 品类：${params.productInfo.category}
- 材质：${params.productInfo.material}
- 玩法：${params.productInfo.gameplay}
- 适用年龄：${params.productInfo.ageRange}
- 卖点：${params.productInfo.sellingPoints.join('、')}

模板：${template.name}
时长：${template.duration}秒
分镜数：${template.shots.length}

请为这个模板的每一个分镜生成：
1. 图片生成提示词（英文，用于AI图片生成）
2. ${targetLang} 配音文案（简洁有力，适合配音）
3. ${targetLang} 字幕文本（简短，适合显示在视频中）

输出JSON格式：
{
  "shots": [
    {
      "seq": 1,
      "seconds": 3,
      "imagePrompt": "英文提示词",
      "voiceover": "${targetLang}配音文案",
      "subtitles": "${targetLang}字幕"
    }
  ]
}

只返回JSON，不要其他文字。`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || '{"shots":[]}');
  } catch (error) {
    console.error('[ToyVideo] 故事板生成失败:', error);
    throw new Error('故事板生成失败，请重试');
  }
}

/** 创建任务记录 */
export async function createTask(params: {
  userId: number;
  sessionId: string;
  templateId: string;
  language: string;
  size: string;
  productInfo: any;
}): Promise<string> {
  const db = getDb();
  const id = params.sessionId || uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO toy_video_tasks (
      id, user_id, template_id, language, size,
      product_info, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.userId,
    params.templateId,
    params.language,
    params.size,
    JSON.stringify(params.productInfo),
    'pending',
    now,
    now
  );

  return id;
}

/** 更新任务状态 */
export async function updateTaskStatus(taskId: string, status: string, result?: any): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  const fields = ['status = ?', 'updated_at = ?'];
  const values: any[] = [status, now];

  if (result) {
    fields.push('result = ?');
    values.push(JSON.stringify(result));
  }

  values.push(taskId);

  db.prepare(`UPDATE toy_video_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

/** 获取任务详情 */
export async function getTask(taskId: string): Promise<any> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM toy_video_tasks WHERE id = ?').get(taskId);
  if (!row) return null;
  
  return {
    ...row,
    product_info: JSON.parse(row.product_info || '{}'),
    result: row.result ? JSON.parse(row.result || '{}') : null,
  };
}

/** 获取用户的任务列表 */
export async function getUserTasks(userId: number): Promise<any[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM toy_video_tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  return rows.map(row => ({
    ...row,
    product_info: JSON.parse(row.product_info || '{}'),
    result: row.result ? JSON.parse(row.result || '{}') : null,
  }));
}
