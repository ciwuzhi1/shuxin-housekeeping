import { useState, useEffect, useRef } from 'react';

/**
 * 统一 API 数据获取 hook
 * 自动处理 API 调用 + Mock fallback 的重复模式
 *
 * 防闪烁设计：
 * - 初始 loading=false，数据先用 fallback 展示
 * - 延迟 200ms 才激活 loading 状态 → 快速 API 不会引起加载闪烁
 * - 仅后续请求（deps 变化）才会立即显示 loading
 *
 * @param fetcher  API 调用函数（返回 Promise）
 * @param fallback 后备数据（API 不可用时使用）
 * @param deps     依赖数组（变化时重新请求）
 */
export function useApiData<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  deps: any[] = []
): {
  data: T;
  loading: boolean;
  apiMode: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(false);
  const [apiMode, setApiMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const cancelledRef = useRef(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    setError(null);

    // 延迟 200ms 才显示 loading，避免快速 API 调用时的闪烁
    loadingTimerRef.current = setTimeout(() => {
      if (!cancelledRef.current) {
        setLoading(true);
      }
    }, 200);

    fetcher()
      .then((result) => {
        if (!cancelledRef.current) {
          setData(result);
          setApiMode(true);
        }
      })
      .catch((err: any) => {
        if (!cancelledRef.current) {
          const msg = err?.message || err?.toString?.() || '未知错误';
          if (import.meta.env.PROD) {
            // 生产环境：API 失败如实进入错误态（error 必定非空），不静默降级 Mock
            setError(msg);
          } else if (err?.code !== 'NETWORK_ERROR') {
            // 开发环境：API 不可用时静默使用 fallback（mock 数据）
            setError(msg);
          }
          setApiMode(false);
        }
      })
      .finally(() => {
        if (!cancelledRef.current) {
          clearTimeout(loadingTimerRef.current!);
          setLoading(false);
        }
      });

    return () => {
      cancelledRef.current = true;
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, [...deps, refreshTick]);

  const reload = () => setRefreshTick(t => t + 1);

  return { data, loading, apiMode, error, reload };
}
