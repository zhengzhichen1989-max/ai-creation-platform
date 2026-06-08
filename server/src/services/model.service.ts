// ============================================================
// AI创作聚合平台 - 模型管理服务（sql.js 原生SQL）
// ============================================================

import { getDb } from "../db/index.js";
import type { ModelListItem, ModelType } from "../types/index.js";
import { ModelNotFoundError } from "../utils/errors.js";

/** 获取模型列表 */
export function listModels(type?: ModelType): ModelListItem[] {
  const db = getDb();

  let sql = "SELECT id, name, type, category, cost_credits, config, duration_options, duration_pricing, resolution_options, resolution_pricing FROM ai_models WHERE enabled = 1";
  const params: unknown[] = [];

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY sort_order";

  const rows = db.exec(sql, params);
  const models: ModelListItem[] = [];

  if (rows.length > 0) {
    for (const row of rows[0].values) {
      models.push({
        id: row[0] as string,
        name: row[1] as string,
        type: row[2] as ModelType,
        category: row[3] as ModelListItem["category"],
        costCredits: row[4] as number,
        config: row[5] as string | null,
        durationOptions: row[6] ? JSON.parse(row[6] as string) : null,
        durationPricing: row[7] ? JSON.parse(row[7] as string) : null,
        resolutionOptions: row[8] ? JSON.parse(row[8] as string) : null,
        resolutionPricing: row[9] ? JSON.parse(row[9] as string) : null,
      });
    }
  }

  return models;
}

/** 获取单个模型 */
export function getModel(modelId: string): ModelListItem {
  const db = getDb();
  const rows = db.exec(
    "SELECT id, name, type, category, cost_credits, config, duration_options, duration_pricing, resolution_options, resolution_pricing FROM ai_models WHERE id = ?",
    [modelId]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new ModelNotFoundError(modelId);
  }

  const row = rows[0].values[0];
  return {
    id: row[0] as string,
    name: row[1] as string,
    type: row[2] as ModelType,
    category: row[3] as ModelListItem["category"],
    costCredits: row[4] as number,
    config: row[5] as string | null,
    durationOptions: row[6] ? JSON.parse(row[6] as string) : null,
    durationPricing: row[7] ? JSON.parse(row[7] as string) : null,
    resolutionOptions: row[8] ? JSON.parse(row[8] as string) : null,
    resolutionPricing: row[9] ? JSON.parse(row[9] as string) : null,
  };
}

/** 获取模型的适配器类名 */
export function getModelAdapterClass(modelId: string): string {
  const db = getDb();
  const rows = db.exec("SELECT adapter_class FROM ai_models WHERE id = ?", [modelId]);
  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new ModelNotFoundError(modelId);
  }
  return rows[0].values[0][0] as string;
}
