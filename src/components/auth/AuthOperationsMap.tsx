const hubs = [
  { x: 146, y: 132, label: "Los Angeles" },
  { x: 195, y: 114, label: "New York" },
  { x: 173, y: 184, label: "Panama" },
  { x: 278, y: 233, label: "Santos" },
  { x: 382, y: 102, label: "Rotterdam" },
  { x: 414, y: 125, label: "Istanbul" },
  { x: 432, y: 162, label: "Cairo" },
  { x: 474, y: 181, label: "Jeddah" },
  { x: 523, y: 150, label: "Mumbai" },
  { x: 588, y: 131, label: "Shanghai" },
  { x: 624, y: 176, label: "Singapore" },
  { x: 703, y: 231, label: "Sydney" }
];

export function AuthOperationsMap() {
  return (
    <div className="auth-operations-map">
      <div className="auth-map-heading">
        <span>Global network</span>
        <strong>Operational footprint</strong>
      </div>

      <svg viewBox="0 0 800 330" role="img" aria-labelledby="auth-map-title auth-map-description">
        <title id="auth-map-title">Global logistics operational footprint</title>
        <desc id="auth-map-description">A world map showing connected logistics hubs across the Americas, Europe, Africa, Asia, and Australia.</desc>

        <g className="world-map-land">
          <path d="M68 82 96 59l43-14 44 9 27 18 34 4 20 16-12 18-26 4-13 19-23 6-13 25-28 2-18-14-22-2-18-25-26-12-11-18 12-13Z" />
          <path d="m212 174 31 10 27 24 21 15 18 36-10 30-25 26-17-14-4-29-19-33-15-26-18-18Z" />
          <path d="m347 76 27-17 36 2 18 17-5 19-23 2-17 13-24-9-17-12Z" />
          <path d="m381 111 35 7 32 25 20 37-8 45-20 39-28 19-24-18-12-46-21-35 7-42Z" />
          <path d="m427 76 45-22 75 1 50 14 49 2 43 20-8 20-36 4-20 17-31 2-19 24-37 8-25 25-37-8-21-31-29-20-31-13 8-19Z" />
          <path d="m655 215 33-10 42 15 17 28-24 25-42-4-28-22Z" />
          <path d="m286 35 24-20 31 4 14 20-19 17-33-4Z" />
          <path d="m713 137 15-11 15 8-8 18-16 4Z" />
        </g>

        <g className="world-map-routes" aria-hidden="true">
          <path d="M146 132 Q275 34 382 102" />
          <path d="M195 114 Q310 75 432 162" />
          <path d="M173 184 Q216 214 278 233" />
          <path d="M382 102 Q490 74 588 131" />
          <path d="M432 162 Q530 202 624 176" />
          <path d="M474 181 Q578 253 703 231" />
        </g>

        <g className="world-map-hubs">
          {hubs.map((hub, index) => (
            <g className="world-map-hub" key={hub.label} style={{ "--hub-delay": `${index * 90}ms` } as CSSProperties}>
              <title>{hub.label}</title>
              <circle className="hub-pulse" cx={hub.x} cy={hub.y} r="12" />
              <circle className="hub-core" cx={hub.x} cy={hub.y} r="4.5" />
              <circle className="hub-center" cx={hub.x} cy={hub.y} r="1.7" />
            </g>
          ))}
        </g>
      </svg>

      <div className="auth-map-status">
        <span>
          <i />
          Live corridors
        </span>
        <strong>12 connected hubs</strong>
      </div>
    </div>
  );
}
import type { CSSProperties } from "react";
