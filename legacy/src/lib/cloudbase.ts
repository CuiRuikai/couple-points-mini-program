import cloudbase from "@cloudbase/js-sdk";
import { getUserErrorMessage } from "@/utils/error";

const envId = process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;

if (!envId) {
  throw new Error("Missing CloudBase env ID");
}

// 只有在浏览器环境下才初始化 SDK
const isBrowser = typeof window !== "undefined";

const app = isBrowser
  ? cloudbase.init({
      env: envId,
    })
  : ({} as any);

export const auth = isBrowser ? app.auth({ persistence: "local" }) : ({} as any);
export const db = isBrowser ? app.database() : ({} as any);
export const cloud = app;

/**
 * 封装云函数调用，处理统一响应格式
 */
export async function callFunction<T = any>(name: string, data?: any): Promise<T> {
  try {
    const { result } = await app.callFunction({
      name,
      data,
    });
    
    // 如果返回了标准格式 { data, error }
    if (result && typeof result === "object" && ("data" in result || "error" in result)) {
      if (result.error) {
        throw new Error(getUserErrorMessage(result.error, "云函数调用失败"));
      }
      return result.data as T;
    }
    
    // 兼容旧格式
    return result as T;
  } catch (err: unknown) {
    throw new Error(getUserErrorMessage(err, "云函数调用失败"));
  }
}

export default app;
