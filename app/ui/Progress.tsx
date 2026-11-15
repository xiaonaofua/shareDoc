/**
 * 屏幕正中间的进度条。
 * percent 有值 = 显示具体进度；没有值 = 来回滚动的“正在处理”动画。
 * 不使用任何 hook，服务端（loading.tsx）和浏览器端都能用。
 */
export default function ProgressOverlay({ label, percent }: { label: string; percent?: number }) {
  const known = typeof percent === "number";
  const pct = known ? Math.max(0, Math.min(100, Math.round(percent))) : 0;
  return (
    <div className="progress-overlay" role="progressbar" aria-label={label} aria-valuenow={known ? pct : undefined}>
      <div className="progress-card">
        <div className="progress-label">{label}</div>
        <div className={known ? "progress-track" : "progress-track indeterminate"}>
          <div className="progress-fill" style={known ? { width: `${pct}%` } : undefined} />
        </div>
        {known && <div className="progress-pct">{pct}%</div>}
      </div>
    </div>
  );
}
