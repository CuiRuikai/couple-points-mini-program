const DOC_SUFFIX_PATTERN = /更多错误信息请访问：\S+/g;
const ERROR_CODE_PREFIX_PATTERN = /^\[[A-Z_]+\]\s*/;
const STACK_PATTERN = /\s+at\s+.+$/;

function pickRawErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;

  if (error instanceof Error) {
    return error.message || "";
  }

  if (typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    const messageFields = [candidate.message, candidate.errMsg, candidate.error];
    for (const field of messageFields) {
      if (typeof field === "string" && field.trim()) {
        return field;
      }
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // noop
    }
  }

  return "";
}

function sanitizeCloudMessage(rawMessage: string): string {
  let message = rawMessage
    .replace(DOC_SUFFIX_PATTERN, "")
    .replace(ERROR_CODE_PREFIX_PATTERN, "")
    .trim();

  const errorMatch = message.match(/Error:\s*([^\n]+)/i);
  if (errorMatch?.[1]) {
    message = errorMatch[1].trim();
  }

  message = message.replace(STACK_PATTERN, "").trim();

  return message;
}

function mapKnownErrorMessage(message: string): string {
  if (/Unauthorized:\s*Missing user identity/i.test(message)) {
    return "登录状态已失效，请重新登录后重试";
  }
  if (/Rule does not belong to your couple/i.test(message)) {
    return "该规则不属于当前情侣空间，请刷新后重试";
  }
  if (/Rule not found or inactive/i.test(message)) {
    return "该规则已下架或删除，请刷新后重试";
  }
  if (/insufficient points|积分不足/i.test(message)) {
    return "积分不足，无法完成该操作";
  }

  return message;
}

export function getUserErrorMessage(error: unknown, fallback = "操作失败"): string {
  const raw = pickRawErrorMessage(error);
  if (!raw) return fallback;

  const sanitized = sanitizeCloudMessage(raw);
  if (!sanitized) return fallback;

  return mapKnownErrorMessage(sanitized);
}

export function isCloudFunctionError(error: unknown): boolean {
  const raw = pickRawErrorMessage(error);
  if (!raw) return false;

  return /(FUNCTIONS_EXECUTE_FAIL|cloud\.callFunction|Unauthorized:\s*Missing user identity|Rule not found or inactive|Rule does not belong to your couple|今日已打卡|请勿重复操作)/i.test(
    raw
  );
}
