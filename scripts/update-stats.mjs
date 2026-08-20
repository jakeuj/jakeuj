import { mkdir, readFile, writeFile } from "node:fs/promises";

const username = "jakeuj";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "jakeuj-profile-stats",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};
const selectedProjects = [
  {
    name: "writerside",
    file: "project-writerside.svg",
    stack: "Writerside · Markdown · GitHub Pages",
    accent: "#22d3ee",
  },
  {
    name: "CodexPlugins",
    file: "project-codex-plugins.svg",
    stack: "Skills · MCP · Shell",
    accent: "#a78bfa",
  },
  {
    name: "pixerDotnet",
    file: "project-pixer-dotnet.svg",
    stack: "C# · .NET 9 · TCP",
    accent: "#4ade80",
  },
  {
    name: "GW2-Nexus-Upgrade-Value",
    displayName: "Upgrade Value",
    file: "project-gw2-upgrade-value.svg",
    stack: "C++ · Nexus · GW2 API",
    accent: "#f0883e",
  },
  {
    name: "ChromeExtensionPobZh",
    displayName: "PoB Sharer",
    description: "One-click Chinese PoB sharing from poe.ninja.",
    file: "project-pob-sharer.svg",
    stack: "JavaScript · Manifest V3 · Chrome/Edge",
    accent: "#f778ba",
  },
];

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

function decodeXml(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function wrapText(value, maxLength = 54, maxLines = 2) {
  const words = String(value || "Open-source engineering project").split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxLength || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").length;
  if (consumed < String(value || "").length && lines.length) {
    lines[lines.length - 1] = `${lines.at(-1).slice(0, maxLength - 1)}…`;
  }
  return lines.slice(0, maxLines);
}

function cardShell(title, description, body, height = 220) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="${height}" viewBox="0 0 495 ${height}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">${escapeXml(description)}</desc>
  <style>
    .card { fill:#0d1117; stroke:#30363d; }
    .title { fill:#58a6ff; font:600 18px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .label { fill:#8b949e; font:500 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .value { fill:#f0f6fc; font:700 23px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .meta { fill:#8b949e; font:400 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .enter { animation:enter .8s ease-out both; }
    .bar { animation:grow 1.1s cubic-bezier(.2,.8,.2,1) both; transform-box:fill-box; transform-origin:left; }
    .pulse { animation:pulse 2.8s ease-in-out infinite; }
    @keyframes enter { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
    @keyframes grow { from { transform:scaleX(0); } to { transform:scaleX(1); } }
    @keyframes pulse { 0%,100% { opacity:.45; } 50% { opacity:1; } }
    @media (prefers-reduced-motion: reduce) {
      .enter,.bar,.pulse { animation:none !important; }
    }
  </style>
  <rect class="card" x=".5" y=".5" width="494" height="${height - 1}" rx="10"/>
  <text class="title" x="22" y="34">${escapeXml(title)}</text>
  ${body}
</svg>
`;
}

function projectCard(repo, project) {
  const displayName = project.displayName || repo.name;
  const summary = project.description || repo.description || project.stack;
  const descriptionLines = wrapText(summary, 55, 2);
  const description = descriptionLines
    .map((line, index) =>
      `<text class="description" x="22" y="${82 + index * 21}">${escapeXml(line)}</text>`)
    .join("\n  ");
  const updated = repo.pushed_at.slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="205" viewBox="0 0 495 205" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(displayName)}</title>
  <desc id="description">${escapeXml(summary)}</desc>
  <style>
    .card { fill:#0d1117; stroke:#30363d; }
    .name { fill:#f0f6fc; font:700 20px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .description { fill:#b1bac4; font:400 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .stack { fill:#8b949e; font:500 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .metric { fill:#c9d1d9; font:600 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .enter { animation:enter .8s ease-out both; }
    .signal { stroke-dasharray:90 410; animation:signal 5s linear infinite; }
    .pulse { animation:pulse 2.5s ease-in-out infinite; }
    @keyframes enter { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes signal { to { stroke-dashoffset:-500; } }
    @keyframes pulse { 0%,100% { opacity:.35; } 50% { opacity:1; } }
    @media (prefers-reduced-motion: reduce) {
      .enter,.signal,.pulse { animation:none !important; }
    }
  </style>
  <rect class="card" x=".5" y=".5" width="494" height="204" rx="12"/>
  <path class="signal" d="M0 2H495" fill="none" stroke="${project.accent}" stroke-width="3"/>
  <g class="enter">
    <circle class="pulse" cx="28" cy="35" r="6" fill="${project.accent}"/>
    <text class="name" x="44" y="42">${escapeXml(displayName)}</text>
    ${description}
    <text class="stack" x="22" y="139">${escapeXml(project.stack)}</text>
    <path d="M22 156H473" stroke="#21262d"/>
    <text class="metric" x="22" y="182">★ ${repo.stargazers_count}</text>
    <text class="metric" x="88" y="182">⑂ ${repo.forks_count}</text>
    <text class="stack" x="284" y="182">pushed ${updated}</text>
  </g>
</svg>
`;
}

function rssValue(item, tag) {
  return decodeXml(
    item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]
      ?.trim() || "",
  );
}

function markdownTitle(value) {
  return value.replace(/[\\[\]*_`]/g, "\\$&").replace(/\s+/g, " ").trim();
}

async function updateRecentPosts() {
  try {
    const response = await fetch("https://www.dotblogs.com.tw/jakeuj/Rss", {
      headers: { "User-Agent": "jakeuj-profile-rss" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`RSS HTTP ${response.status}`);
    const xml = await response.text();
    const posts = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
      .slice(0, 3)
      .map((match) => {
        const title = rssValue(match[1], "title");
        const link = rssValue(match[1], "link");
        const rawDate = rssValue(match[1], "pubDate");
        const parsedDate = new Date(rawDate);
        const date = Number.isNaN(parsedDate.valueOf())
          ? ""
          : parsedDate.toISOString().slice(0, 10);
        return { title, link, date };
      })
      .filter((post) => post.title && /^https:\/\/www\.dotblogs\.com\.tw\//.test(post.link));
    if (!posts.length) throw new Error("RSS did not contain usable posts");

    const start = "<!-- BLOG-POST-LIST:START -->";
    const end = "<!-- BLOG-POST-LIST:END -->";
    const readme = await readFile("README.md", "utf8");
    if (!readme.includes(start) || !readme.includes(end)) {
      throw new Error("README blog markers are missing");
    }
    const list = posts
      .map((post) =>
        `- [**${markdownTitle(post.title)}**](${post.link})${post.date ? ` — ${post.date}` : ""}`)
      .join("\n");
    const nextReadme = readme.replace(
      new RegExp(`${start}[\\s\\S]*?${end}`),
      `${start}\n${list}\n${end}`,
    );
    await writeFile("README.md", nextReadme);
  } catch (error) {
    console.warn(`Recent posts unchanged: ${error.message}`);
  }
}

const user = await github(`/users/${username}`);
const repos = await github(
  `/users/${username}/repos?per_page=100&type=owner&sort=updated`,
);
const sourceRepos = repos.filter((repo) => !repo.fork);
const activeRepos = sourceRepos.filter((repo) => !repo.archived);
const latestRepo = activeRepos
  .filter((repo) => repo.name.toLowerCase() !== username)
  .sort((left, right) => Date.parse(right.pushed_at) - Date.parse(left.pushed_at))[0];
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
  return `<g class="enter" style="animation-delay:${index * 100}ms">
    <text class="value" x="${x}" y="${y}">${escapeXml(value)}</text>
    <text class="label" x="${x}" y="${y + 19}">${escapeXml(label)}</text>
  </g>`;
}).join("\n  ");
const currentBody = latestRepo
  ? `<circle class="pulse" cx="28" cy="181" r="5" fill="#3fb950"/>
  <text class="label" x="42" y="185">Currently building</text>
  <text class="meta" x="152" y="185">${escapeXml(latestRepo.name)} · pushed ${latestRepo.pushed_at.slice(0, 10)}</text>`
  : "";

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
  const y = 61 + index * 25;
  const width = Math.round((count / maxLanguageCount) * 285);
  return `<g class="enter" style="animation-delay:${index * 90}ms">
    <text class="label" x="22" y="${y}">${escapeXml(language)}</text>
    <rect x="130" y="${y - 10}" width="285" height="10" rx="5" fill="#21262d"/>
    <rect class="bar" x="130" y="${y - 10}" width="${width}" height="10" rx="5" fill="${colors[index]}" style="animation-delay:${index * 90}ms"/>
    <text class="meta" x="430" y="${y}">${count} repos</text>
  </g>`;
}).join("\n  ");

await mkdir("assets", { recursive: true });
await writeFile(
  "assets/github-stats.svg",
  cardShell(
    "GitHub engineering snapshot",
    "Live repository, star, fork, experience, and current project statistics.",
    `${statsBody}
  ${currentBody}
  <text class="meta" x="384" y="207">Updated ${updated}</text>`,
  ),
);
await writeFile(
  "assets/top-languages.svg",
  cardShell(
    "Languages across active repositories",
    "Animated bars showing the primary languages across active public repositories.",
    `${languageBody}
  <text class="meta" x="22" y="207">Primary language by repository · Updated ${updated}</text>`,
  ),
);

for (const project of selectedProjects) {
  const repo = sourceRepos.find(
    (candidate) => candidate.name.toLowerCase() === project.name.toLowerCase(),
  );
  if (!repo) {
    console.warn(`Project card skipped: ${project.name}`);
    continue;
  }
  await writeFile(`assets/${project.file}`, projectCard(repo, project));
}

await updateRecentPosts();
