// ============================================================
// AI创作聚合平台 - 数据库 Schema 定义（仅供参考，实际使用原生SQL）
// ============================================================

// 注意：本项目使用 sql.js 原生 SQL 进行数据库操作
// 此文件仅作为表结构参考，drizzle-orm schema 仅供参考

/**
 * 数据表结构定义：
 *
 * users — 用户表
 * | 字段 | 类型 | 约束 | 说明 |
 * |------|------|------|------|
 * | id | INTEGER | PK, AUTO | 用户ID |
 * | email | TEXT | UNIQUE, NOT NULL | 邮箱 |
 * | password_hash | TEXT | NOT NULL | bcrypt哈希密码 |
 * | nickname | TEXT | NOT NULL | 昵称 |
 * | avatar_url | TEXT | | 头像URL |
 * | role | TEXT | NOT NULL, DEFAULT 'user' | 角色：user/admin |
 * | created_at | TEXT | NOT NULL, DEFAULT now | 创建时间 |
 * | updated_at | TEXT | NOT NULL, DEFAULT now | 更新时间 |
 *
 * credit_accounts — 积分账户表
 * | 字段 | 类型 | 约束 | 说明 |
 * |------|------|------|------|
 * | id | INTEGER | PK, AUTO | 账户ID |
 * | user_id | INTEGER | FK→users.id, UNIQUE | 用户ID（1:1） |
 * | balance | INTEGER | NOT NULL, DEFAULT 0 | 当前余额（积分） |
 * | version | INTEGER | NOT NULL, DEFAULT 0 | 乐观锁版本号 |
 * | created_at | TEXT | NOT NULL | 创建时间 |
 * | updated_at | TEXT | NOT NULL | 更新时间 |
 *
 * credit_transactions — 积分流水表
 * | 字段 | 类型 | 约束 | 说明 |
 * |------|------|------|------|
 * | id | INTEGER | PK, AUTO | 流水ID |
 * | user_id | INTEGER | FK→users.id | 用户ID |
 * | type | TEXT | NOT NULL | 类型：purchase/consume/refund |
 * | amount | INTEGER | NOT NULL | 变动数量（正数） |
 * | balance_after | INTEGER | NOT NULL | 变动后余额 |
 * | reference_id | TEXT | | 关联ID |
 * | description | TEXT | | 描述 |
 * | created_at | TEXT | NOT NULL | 创建时间 |
 *
 * ai_models — AI模型表
 * | 字段 | 类型 | 约束 | 说明 |
 * |------|------|------|------|
 * | id | TEXT | PK | 模型标识 |
 * | name | TEXT | NOT NULL | 模型显示名称 |
 * | type | TEXT | NOT NULL | 类型：image/video |
 * | category | TEXT | NOT NULL | 定位：starter/standard/advanced/flagship |
 * | cost_credits | INTEGER | NOT NULL | 单次消耗积分 |
 * | adapter_class | TEXT | NOT NULL | 适配器类名 |
 * | enabled | INTEGER | NOT NULL, DEFAULT 1 | 是否启用 |
 * | config | TEXT | | 模型特定配置JSON |
 * | sort_order | INTEGER | NOT NULL, DEFAULT 0 | 排序权重 |
 * | created_at | TEXT | NOT NULL | 创建时间 |
 * | updated_at | TEXT | NOT NULL | 更新时间 |
 *
 * generation_tasks — 生成任务表
 * | 字段 | 类型 | 约束 | 说明 |
 * |------|------|------|------|
 * | id | TEXT | PK | 任务UUID |
 * | user_id | INTEGER | FK→users.id | 用户ID |
 * | model_id | TEXT | FK→ai_models.id | 模型ID |
 * | type | TEXT | NOT NULL | 类型：image/video |
 * | prompt | TEXT | NOT NULL | 提示词 |
 * | params | TEXT | | 生成参数JSON |
 * | status | TEXT | NOT NULL, DEFAULT pending | 状态 |
 * | cost_credits | INTEGER | NOT NULL | 消耗积分 |
 * | result_url | TEXT | | 结果URL |
 * | result_thumbnail | TEXT | | 缩略图URL |
 * | error_message | TEXT | | 失败原因 |
 * | progress | INTEGER | DEFAULT 0 | 进度百分比 |
 * | started_at | TEXT | | 开始时间 |
 * | completed_at | TEXT | | 完成时间 |
 * | created_at | TEXT | NOT NULL | 创建时间 |
 *
 * credit_packages — 积分商品包
 * | 字段 | 类型 | 约束 | 说明 |
 * |------|------|------|------|
 * | id | TEXT | PK | 包ID |
 * | name | TEXT | NOT NULL | 包名称 |
 * | credits | INTEGER | NOT NULL | 积分数量 |
 * | price_cents | INTEGER | NOT NULL | 价格（分） |
 * | unit_label | TEXT | | 单位标签 |
 * | enabled | INTEGER | NOT NULL, DEFAULT 1 | 是否上架 |
 * | sort_order | INTEGER | DEFAULT 0 | 排序 |
 * | created_at | TEXT | NOT NULL | 创建时间 |
 */
