// ============================================================
// AI创作聚合平台 - 认证服务（sql.js 原生SQL）
// ============================================================

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getDb, saveDatabase } from "../db/index.js";
import type { AuthResult, UserInfo, JwtPayload, ForgotPasswordResult } from "../types/index.js";
import { UserExistsError, InvalidCredentialsError, InvalidResetTokenError, SecurityQuestionError } from "../utils/errors.js";
import { config } from "../config/index.js";

const BCRYPT_ROUNDS = 10;

/** 用户注册 */
export async function register(email: string, password: string, nickname: string): Promise<AuthResult> {
  const db = getDb();

  // 检查邮箱是否已注册
  const existingRows = db.exec("SELECT id FROM users WHERE email = ?", [email]);
  if (existingRows.length > 0 && existingRows[0].values.length > 0) {
    throw new UserExistsError(email);
  }

  // 哈希密码
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // 创建用户 + 积分账户（事务）
  db.run("BEGIN TRANSACTION");
  try {
    db.run(
      "INSERT INTO users (email, password_hash, nickname, role) VALUES (?, ?, ?, ?)",
      [email, passwordHash, nickname, "user"]
    );

    const userIdResult = db.exec("SELECT last_insert_rowid() as id");
    const userId = userIdResult[0].values[0][0] as number;

    // 创建积分账户，赠送50积分
    db.run(
      "INSERT INTO credit_accounts (user_id, balance, version) VALUES (?, 50, 0)",
      [userId]
    );

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  // 获取新创建的用户
  const userRows = db.exec("SELECT id, email, nickname, avatar_url, role FROM users WHERE email = ?", [email]);
  const user = userRows[0].values[0];

  saveDatabase();

  // 生成 Token
  const { accessToken, refreshToken } = generateTokens(user[0] as number, user[1] as string, user[4] as string);

  return {
    user: {
      id: user[0] as number,
      email: user[1] as string,
      nickname: user[2] as string,
      avatarUrl: user[3] as string | null,
      role: user[4] as string,
    },
    accessToken,
    refreshToken,
  };
}

/** 用户登录 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const db = getDb();

  // 查找用户
  const rows = db.exec("SELECT id, email, nickname, avatar_url, password_hash, role FROM users WHERE email = ?", [email]);
  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new InvalidCredentialsError();
  }

  const user = rows[0].values[0];
  const passwordHash = user[4] as string;

  // 验证密码
  const passwordMatch = await bcrypt.compare(password, passwordHash);
  if (!passwordMatch) {
    throw new InvalidCredentialsError();
  }

  // 生成 Token
  const { accessToken, refreshToken } = generateTokens(user[0] as number, user[1] as string, user[5] as string);

  return {
    user: {
      id: user[0] as number,
      email: user[1] as string,
      nickname: user[2] as string,
      avatarUrl: user[3] as string | null,
      role: user[5] as string,
    },
    accessToken,
    refreshToken,
  };
}

/** 刷新 Token */
export function refreshTokens(refreshToken: string): { accessToken: string; refreshToken: string } {
  const decoded = decodeRefreshToken(refreshToken);
  return generateTokens(decoded.userId, decoded.email, decoded.role);
}

/** 获取用户信息 */
export function getUserById(userId: number): UserInfo {
  const db = getDb();
  const rows = db.exec("SELECT id, email, nickname, avatar_url, role FROM users WHERE id = ?", [userId]);
  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new InvalidCredentialsError("用户不存在");
  }
  const user = rows[0].values[0];
  return {
    id: user[0] as number,
    email: user[1] as string,
    nickname: user[2] as string,
    avatarUrl: user[3] as string | null,
    role: user[4] as string,
  };
}

/** 用户通过重置Token重置密码 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const db = getDb();

  // 查找有效的Token
  const tokenRows = db.exec(
    "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?",
    [token]
  );

  if (tokenRows.length === 0 || tokenRows[0].values.length === 0) {
    throw new InvalidResetTokenError("重置链接无效或已过期");
  }

  const tokenRow = tokenRows[0].values[0];
  const tokenId = tokenRow[0] as number;
  const userId = tokenRow[1] as number;
  const expiresAt = tokenRow[2] as string;
  const usedAt = tokenRow[3] as string | null;

  // 检查是否已使用
  if (usedAt) {
    throw new InvalidResetTokenError("重置链接已被使用");
  }

  // 检查是否过期
  const expiresTime = new Date(expiresAt).getTime();
  if (Date.now() > expiresTime) {
    throw new InvalidResetTokenError("重置链接已过期");
  }

  // 更新密码
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [
    passwordHash,
    userId,
  ]);

  // 标记Token已使用
  db.run("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?", [tokenId]);

  saveDatabase();
}

/** 忘记密码 - 查询用户是否有安全问题 */
export function forgotPassword(email: string): ForgotPasswordResult {
  const db = getDb();

  const rows = db.exec(
    "SELECT security_question FROM users WHERE email = ?",
    [email]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    // 用户不存在，仍返回无安全问题（不泄露用户是否存在）
    return { hasSecurityQuestion: false, question: null };
  }

  const question = rows[0].values[0][0] as string | null;
  if (!question) {
    return { hasSecurityQuestion: false, question: null };
  }

  return { hasSecurityQuestion: true, question };
}

/** 验证安全问题答案 */
export async function verifySecurityAnswer(email: string, answer: string): Promise<{ token: string }> {
  const db = getDb();

  const rows = db.exec(
    "SELECT id, security_answer_hash FROM users WHERE email = ?",
    [email]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new SecurityQuestionError("用户不存在或未设置安全问题");
  }

  const userRow = rows[0].values[0];
  const userId = userRow[0] as number;
  const answerHash = userRow[1] as string | null;

  if (!answerHash) {
    throw new SecurityQuestionError("用户未设置安全问题");
  }

  // 验证答案
  const isMatch = await bcrypt.compare(answer, answerHash);
  if (!isMatch) {
    throw new SecurityQuestionError("安全问题答案错误");
  }

  // 生成重置Token
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

  db.run(
    "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
    [userId, token, expiresAt]
  );

  saveDatabase();

  return { token };
}

/** 修改密码（已登录用户，验证旧密码后更新） */
export async function changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
  const db = getDb();

  // 查找用户
  const rows = db.exec("SELECT password_hash FROM users WHERE id = ?", [userId]);
  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new InvalidCredentialsError("用户不存在");
  }

  const passwordHash = rows[0].values[0][0] as string;

  // 验证旧密码
  const isMatch = await bcrypt.compare(oldPassword, passwordHash);
  if (!isMatch) {
    throw new InvalidCredentialsError("旧密码不正确");
  }

  // 新密码不能与旧密码相同
  const isSame = await bcrypt.compare(newPassword, passwordHash);
  if (isSame) {
    throw new InvalidCredentialsError("新密码不能与旧密码相同");
  }

  // 更新密码
  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [
    newHash,
    userId,
  ]);

  saveDatabase();
}

/** 设置安全问题（需认证） */
export async function setSecurityQuestion(userId: number, question: string, answer: string): Promise<void> {
  const db = getDb();

  const answerHash = await bcrypt.hash(answer, BCRYPT_ROUNDS);

  db.run(
    "UPDATE users SET security_question = ?, security_answer_hash = ?, updated_at = datetime('now') WHERE id = ?",
    [question, answerHash, userId]
  );

  saveDatabase();
}

// ---- 内部辅助函数 ----

function generateTokens(userId: number, email: string, role: string): { accessToken: string; refreshToken: string } {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const accessPayload = btoa(JSON.stringify({
    userId,
    email,
    role,
    type: "access",
    exp: Math.floor(Date.now() / 1000) + config.jwt.accessExpiresIn,
  }));
  const refreshPayload = btoa(JSON.stringify({
    userId,
    email,
    role,
    type: "refresh",
    exp: Math.floor(Date.now() / 1000) + config.jwt.refreshExpiresIn,
  }));
  const signature = btoa(`${config.jwt.secret}-${Date.now()}`);
  const accessToken = `${header}.${accessPayload}.${signature}`;
  const refreshToken = `${header}.${refreshPayload}.${signature}`;

  return { accessToken, refreshToken };
}

function decodeRefreshToken(token: string): JwtPayload {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new InvalidCredentialsError("无效的刷新令牌");
    }
    const payload = JSON.parse(atob(parts[1]));
    if (payload.type !== "refresh") {
      throw new InvalidCredentialsError("不是刷新令牌");
    }
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new InvalidCredentialsError("刷新令牌已过期");
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch (err) {
    if (err instanceof InvalidCredentialsError) throw err;
    throw new InvalidCredentialsError("无效的刷新令牌");
  }
}
