import { mkdir, writeFile } from "node:fs/promises";

const USERNAME = process.env.GITHUB_USERNAME || process.env.GITHUB_REPOSITORY_OWNER;
const TOKEN = process.env.GITHUB_TOKEN;
const DAYS = 182;
const WINDOW_LABEL = "last 6 months";

if (!USERNAME || !TOKEN) {
  throw new Error("GITHUB_USERNAME/GITHUB_REPOSITORY_OWNER and GITHUB_TOKEN are required");
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, amount) {
  return new Date(date.getTime() + amount * DAY_MS);
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function xml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const endDate = new Date();
const startDate = addDays(endDate, -(DAYS - 1));
const from = new Date(`${dateOnly(startDate)}T00:00:00.000Z`);
const to = new Date(`${dateOnly(endDate)}T23:59:59.999Z`);

const query = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
  body: JSON.stringify({
    query,
    variables: { login: USERNAME, from: from.toISOString(), to: to.toISOString() },
  }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
if (payload.errors?.length) {
  throw new Error(payload.errors.map((error) => error.message).join("; "));
}

const contributionDays = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks
  ?.flatMap((week) => week.contributionDays) ?? [];
const counts = new Map(contributionDays.map((day) => [day.date, day.contributionCount]));
const days = Array.from({ length: DAYS }, (_, index) => {
  const date = dateOnly(addDays(startDate, index));
  return { date, count: counts.get(date) ?? 0 };
});

const total = days.reduce((sum, day) => sum + day.count, 0);
const peak = Math.max(...days.map((day) => day.count), 0);
const peakDay = days.find((day) => day.count === peak) ?? days.at(-1);

const palettes = {
  dark: {
    background: "#0d1117",
    border: "#30363d",
    text: "#8b949e",
    strong: "#f0f6fc",
    grid: "#21262d",
    levels: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
    line: "#39d353",
  },
  light: {
    background: "#ffffff",
    border: "#d0d7de",
    text: "#57606a",
    strong: "#24292f",
    grid: "#eaeef2",
    levels: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
    line: "#1a7f37",
  },
};

function level(count) {
  if (count === 0 || peak === 0) return 0;
  if (peak === 1) return 4;
  if (count >= peak * 0.75) return 4;
  if (count >= peak * 0.5) return 3;
  if (count >= peak * 0.25) return 2;
  return 1;
}

function shell({ palette, width, height, content }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <title>Recent GitHub activity for ${xml(USERNAME)}</title>
  <rect width="${width}" height="${height}" rx="8" fill="${palette.background}" stroke="${palette.border}" />
  <g font-family="SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace">
${content}
  </g>
</svg>
`;
}

function makeHeatmap(palette) {
  const width = 820;
  const height = 178;
  const cell = 12;
  const gap = 4;
  const columns = Math.ceil(days.length / 7);
  const gridX = 318;
  const gridY = 50;
  const cells = days.map((day, index) => {
    const column = Math.floor(index / 7);
    const row = index % 7;
    const x = gridX + column * (cell + gap);
    const y = gridY + row * (cell + gap);
    return `    <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${palette.levels[level(day.count)]}"><title>${xml(day.date)}: ${day.count} contribution${day.count === 1 ? "" : "s"}</title></rect>`;
  }).join("\n");
  const labels = Array.from({ length: columns }, (_, column) => {
    const day = days[column * 7];
    if (!day || column % 4 !== 0) return "";
    const x = gridX + column * (cell + gap);
    return `    <text x="${x}" y="37" fill="${palette.text}" font-size="10">${day.date.slice(5)}</text>`;
  }).join("\n");

  return shell({
    palette,
    width,
    height,
    content: `    <text x="28" y="34" fill="${palette.strong}" font-size="18" font-weight="700">contribution / recent</text>
    <text x="28" y="64" fill="${palette.text}" font-size="13">${WINDOW_LABEL}</text>
    <text x="28" y="91" fill="${palette.strong}" font-size="23" font-weight="700">${total}</text>
    <text x="28" y="111" fill="${palette.text}" font-size="11">contributions</text>
    <text x="28" y="144" fill="${palette.text}" font-size="11">peak ${peak} / ${xml(peakDay.date)}</text>
${labels}
${cells}`,
  });
}

function makeTelemetry(palette) {
  const width = 820;
  const height = 210;
  const chartX = 36;
  const chartY = 76;
  const chartWidth = 748;
  const chartHeight = 91;
  const maxValue = Math.max(peak, 1);
  const points = days.map((day, index) => {
    const x = chartX + (index * chartWidth) / (days.length - 1);
    const y = chartY + chartHeight - (day.count / maxValue) * chartHeight;
    return { ...day, x, y };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = `${line} L${points.at(-1).x.toFixed(2)},${chartY + chartHeight} L${points[0].x.toFixed(2)},${chartY + chartHeight} Z`;
  const guides = [0, 0.5, 1].map((ratio) => {
    const y = chartY + chartHeight - ratio * chartHeight;
    return `    <line x1="${chartX}" y1="${y}" x2="${chartX + chartWidth}" y2="${y}" stroke="${palette.grid}" stroke-width="1" />`;
  }).join("\n");
  const markers = points.filter((point) => point.count > 0).map((point) => {
    return `    <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5" fill="${palette.line}"><title>${xml(point.date)}: ${point.count} contribution${point.count === 1 ? "" : "s"}</title></circle>`;
  }).join("\n");

  return shell({
    palette,
    width,
    height,
    content: `    <text x="28" y="33" fill="${palette.strong}" font-size="18" font-weight="700">github / telemetry</text>
    <text x="28" y="56" fill="${palette.text}" font-size="12">${WINDOW_LABEL} activity</text>
    <text x="774" y="34" text-anchor="end" fill="${palette.text}" font-size="12">peak ${peak} / ${xml(peakDay.date)}</text>
${guides}
    <path d="${area}" fill="${palette.line}" fill-opacity="0.16" />
    <path d="${line}" fill="none" stroke="${palette.line}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
${markers}
    <text x="${chartX}" y="190" fill="${palette.text}" font-size="10">${days[0].date}</text>
    <text x="${chartX + chartWidth}" y="190" text-anchor="end" fill="${palette.text}" font-size="10">${days.at(-1).date}</text>`,
  });
}

await mkdir("dist", { recursive: true });
await Promise.all([
  writeFile("dist/recent-contributions.svg", makeHeatmap(palettes.light)),
  writeFile("dist/recent-contributions-dark.svg", makeHeatmap(palettes.dark)),
  writeFile("dist/recent-telemetry.svg", makeTelemetry(palettes.light)),
  writeFile("dist/recent-telemetry-dark.svg", makeTelemetry(palettes.dark)),
]);

console.log(`Generated recent contribution visuals for ${USERNAME}: ${total} contributions in the last ${DAYS} days`);
