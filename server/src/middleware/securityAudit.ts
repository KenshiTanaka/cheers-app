import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : path.resolve(__dirname, '../../data');
const auditLogPath = path.join(dataDir, 'security-audit.log');
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// 典型的な攻撃・脆弱性スキャンパターン
const SUSPICIOUS_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'PATH_TRAVERSAL', regex: /(\.\.[/\\]|%2e%2e%2f|%2e%2e\/)/i },
  { name: 'SQL_INJECTION', regex: /(\bUNION\b\s+\bSELECT\b|\bOR\b\s+1\s*=\s*1|;\s*DROP\s+TABLE|--\s*$)/i },
  { name: 'XSS_ATTEMPT', regex: /(<script|javascript:|onerror\s*=|onload\s*=)/i },
  { name: 'SENSITIVE_FILE_PROBE', regex: /(\.env|\.git|wp-login|wp-admin|phpmyadmin|\/etc\/passwd|id_rsa)/i },
];

export type SecurityEventLevel = 'INFO' | 'WARN' | 'CRITICAL';

export function logSecurityEvent(
  level: SecurityEventLevel,
  event: string,
  details: Record<string, unknown>
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  };
  const line = JSON.stringify(entry);

  if (level === 'CRITICAL' || level === 'WARN') {
    console.warn(`[SECURITY:${level}] ${event}`, JSON.stringify(details));
  }

  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(auditLogPath)) {
      const stat = fs.statSync(auditLogPath);
      if (stat.size > MAX_LOG_SIZE_BYTES) {
        fs.renameSync(auditLogPath, `${auditLogPath}.1`);
      }
    }
    fs.appendFileSync(auditLogPath, line + '\n', 'utf8');
  } catch (err) {
    console.error('[SECURITY] Failed to write audit log:', err);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function securityAuditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || 'unknown';
  const target = `${req.originalUrl || req.url}`;

  // リクエストURL・クエリ内の不審パターン検知
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.regex.test(target)) {
      logSecurityEvent('CRITICAL', `ATTACK_DETECTED_${pattern.name}`, {
        ip,
        method: req.method,
        path: target.slice(0, 300),
        userAgent: String(ua).slice(0, 200),
      });
      break;
    }
  }

  // レスポンス完了後に異常ステータス（401/403/429）を記録
  res.on('finish', () => {
    const status = res.statusCode;
    if (status === 401 || status === 403 || status === 429) {
      const level: SecurityEventLevel = status === 429 ? 'CRITICAL' : 'WARN';
      const eventName =
        status === 429
          ? 'RATE_LIMIT_EXCEEDED'
          : status === 403
          ? 'FORBIDDEN_ACCESS'
          : 'UNAUTHORIZED_ACCESS';

      logSecurityEvent(level, eventName, {
        ip,
        method: req.method,
        path: (req.originalUrl || req.url).slice(0, 300),
        status,
        userAgent: String(ua).slice(0, 200),
      });
    }
  });

  next();
}
