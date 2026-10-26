// Charts and score widgets ported from v2/app.js (barChart, ring, spark, checklist).
import { R } from "@proofpocket/shared";

export interface Point { label: string; moneyIn: number; moneyOut: number }

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Money in and out per month; the last bar is "this month so far". */
export function BarChart({ series, label = "Money in and out, last six months" }: { series: Point[]; label?: string }) {
  const W = 600, H = 220, L = 52, B = 26, T = 10, Rr = 8;
  const max = niceMax(Math.max(...series.map((m) => Math.max(m.moneyIn, m.moneyOut))));
  const ih = H - B - T, iw = W - L - Rr, gw = iw / series.length, bw = Math.min(26, gw / 3);
  const y = (v: number) => T + ih - (v / max) * ih;
  return (
    <>
      <div className="chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (max / 4) * i;
            return (
              <g key={i}>
                <line className="grid-l" x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} />
                <text className="axis" x={L - 8} y={y(v) + 3} textAnchor="end">{v >= 1000 ? +(v / 1000).toFixed(1) + "k" : v}</text>
              </g>
            );
          })}
          {series.map((m, i) => {
            const cx = L + gw * i + gw / 2;
            return (
              <g key={m.label}>
                <rect className="b-in" x={cx - bw - 1} y={y(m.moneyIn)} width={bw} height={Math.max(0, T + ih - y(m.moneyIn))} rx={2}><title>{`${m.label} money in ${R(m.moneyIn)}`}</title></rect>
                <rect className="b-out" x={cx + 1} y={y(m.moneyOut)} width={bw} height={Math.max(0, T + ih - y(m.moneyOut))} rx={2}><title>{`${m.label} money out ${R(m.moneyOut)}`}</title></rect>
                <text className="axis" x={cx} y={H - 8} textAnchor="middle">{m.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="row between">
        <div className="legend"><span><i style={{ background: "var(--bar-in)" }} />Money in</span><span><i style={{ background: "var(--bar-out)" }} />Money out</span></div>
        <span className="small muted">* this month so far · Rand</span>
      </div>
    </>
  );
}

export function Ring({ score, small }: { score: number; small?: boolean }) {
  const size = small ? 44 : 108, sw = small ? 5 : 9, r = (size - sw) / 2, cc = 2 * Math.PI * r;
  return (
    <div className="ring" style={small ? { width: 44, height: 44 } : undefined} role="img" aria-label={`Readiness ${score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} />
        <circle className="val" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} strokeLinecap="round" strokeDasharray={cc} strokeDashoffset={cc * (1 - score / 100)} />
      </svg>
      <div className="txt"><div><b style={small ? { fontSize: ".8rem" } : undefined}>{score}</b>{!small && <span className="small muted">of 100</span>}</div></div>
    </div>
  );
}

export const ScoreCell = ({ score }: { score: number }) => (
  <div className="score-cell"><span className="num">{score}</span><div className="bar"><i style={{ width: `${score}%` }} /></div></div>
);

/** Income over a few months, as a small line. */
export function Spark({ values }: { values: number[] }) {
  const W = 84, H = 24, max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => [2 + (i * (W - 4)) / Math.max(1, values.length - 1), H - 3 - ((v - min) / (max - min || 1)) * (H - 6)] as const);
  const last = pts[pts.length - 1]!;
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r={2.5} />
    </svg>
  );
}

export interface CheckItem { label: string; hint: string; pts: number; ok: boolean; state?: string }

/** Readiness items with ✓ / … / × and points (v2: checklist). */
export function Checklist({ items }: { items: CheckItem[] }) {
  return (
    <div>
      {items.map((i) => {
        const cls = i.ok ? "ok" : i.state === "pending" ? "wait" : "no";
        return (
          <div key={i.label} className="ck">
            <span className={`mark ${cls}`} aria-hidden="true">{i.ok ? "✓" : i.state === "pending" ? "…" : "×"}</span>
            <div><div>{i.label}</div><div className="hint">{i.hint}</div></div>
            <span className="pts">{i.ok ? `+${i.pts}` : "0"}/{i.pts}</span>
          </div>
        );
      })}
    </div>
  );
}
