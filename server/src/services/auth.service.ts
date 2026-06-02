// ============================================================
// AI创作聚合平台 - 认证服务（sql.js 原生SQL）
// ============================================================

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { getDb, saveDatabase } from "../db/index.js";
import type { AuthResult, UserInfo, JwtPayload } from "../types/index.js";
import { UserExistsError, InvalidCredentialsError } from "../utils/errors.js";
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
