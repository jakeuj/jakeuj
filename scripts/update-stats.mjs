import { mkdir, writeFile } from "node:fs/promises";

const username = "jakeuj";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "jakeuj-profile-stats",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${path}`);
  }
  return response.json();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cardShell(title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="190" role="img" aria-label="${escapeXml(title)}">
  <style>
    .card { fill: #0d1117; stroke: #30363d; }
    .title { fill: #58a6ff; font: 600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .label { fill: #8b949e; font: 500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .value { fill: #f0f6fc; font: 700 23px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .meta { fill: #8b949e; font: 400 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  </style>
  <rect class="card" x="0.5" y="0.5" width="494" height="189" rx="10"/>
  <text class="title" x="22" y="34">${escapeXml(title)}</text>
  ${body}
</svg>
`;
}

const user = await github(`/users/${username}`);
const repos = await github(
  `/users/${username}/repos?per_page=100&type=owner&sort=updated`,
);
const sourceRepos = repos.filter((repo) => !repo.fork);
const activeRepos = sourceRepos.filter((repo) => !repo.archived);
const totalStars = sourceRepos.reduce(
  (total, repo) => total + repo.stargazers_count,
  0,
);
const totalForks = sourceRepos.reduce(
  (total, repo) => total + repo.forks_count,
  0,
);
const yearsBuilding = new Date().getUTCFullYear()
  - new Date(user.created_at).getUTCFullYear();
const updated = new Date().toISOString().slice(0, 10);

const statsBody = [
  ["Public repos", user.public_repos],
  ["Total stars", totalStars],
  ["Total forks", totalForks],
  ["Years building", `${yearsBuilding}+`],
].map(([label, value], index) => {
  const x = 22 + (index % 2) * 238;
  const y = 76 + Math.floor(index / 2) * 58;
  return `<text class="value" x="${x}" y="${y}">${escapeXml(value)}</text>
  <text class="label" x="${x}" y="${y + 19}">${escapeXml(label)}</text>`;
}).join("\n  ");

const languageCounts = new Map();
for (const repo of activeRepos) {
  if (!repo.language) continue;
  languageCounts.set(
    repo.language,
    (languageCounts.get(repo.language) || 0) + 1,
  );
}

const languages = [...languageCounts.entries()]
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .slice(0, 5);
const maxLanguageCount = Math.max(...languages.map(([, count]) => count), 1);
const colors = ["#58a6ff", "#a371f7", "#3fb950", "#f0883e", "#f778ba"];
const languageBody = languages.map(([language, count], index) => {
  const y = 61 + index * 23;
  const width = Math.round((count / maxLanguageCount) * 285);
  return `<text class="label" x="22" y="${y}">${escapeXml(language)}</text>
  <rect x="130" y="${y - 10}" width="285" height="10" rx="5" fill="#21262d"/>
  <rect x="130" y="${y - 10}" width="${width}" height="10" rx="5" fill="${colors[index]}"/>
  <text class="meta" x="430" y="${y}">${count} repos</text>`;
}).join("\n  ");

await mkdir("assets", { recursive: true });
await writeFile(
  "assets/github-stats.svg",
  cardShell(
    "GitHub engineering snapshot",
    `${statsBody}
  <text class="meta" x="340" y="177">Updated ${updated}</text>`,
  ),
);
await writeFile(
  "assets/top-languages.svg",
  cardShell(
    "Languages across active repositories",
    `${languageBody}
  <text class="meta" x="22" y="177">Primary language by repository</text>`,
  ),
);
