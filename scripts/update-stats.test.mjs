import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { updateProfile, wrapText } from "./update-stats.mjs";

test("wrapText fills both lines before truncating", () => {
  assert.deepEqual(wrapText("Short text", 10, 2), ["Short text"]);
  assert.deepEqual(wrapText("one two three four", 10, 2), ["one two", "three four"]);
  assert.deepEqual(wrapText("one two three four five", 10, 2), ["one two", "three fou…"]);
  assert.deepEqual(wrapText("  one   two  ", 10, 2), ["one two"]);
  assert.deepEqual(wrapText("abcdefghijklmnop", 10, 2), ["abcdefghij", "klmnop"]);
  assert.deepEqual(wrapText("abcdefghijklmnopqrstu", 10, 2), ["abcdefghij", "klmnopqrs…"]);
});

test("profile refresh preserves editorial content and handles RSS failures", async (t) => {
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const directory = await mkdtemp(join(tmpdir(), "profile-refresh-test-"));
  const names = ["writerside", "CodexPlugins", "pixerDotnet", "architect-pc-builder",
    "GW2-Nexus-Upgrade-Value", "ChromeExtensionPobZh"];
  const repos = names.map((name) => ({
    name, fork: false, archived: false, language: "JavaScript",
    pushed_at: "2026-10-20T00:00:00Z", stargazers_count: 0, forks_count: 0,
    description: "Remote description must not replace editorial copy",
  }));
  repos.push({ ...repos[0], name: 'Repo<&"', pushed_at: "2026-10-21T00:00:00Z" });
  const user = { public_repos: repos.length, created_at: "2011-01-01T00:00:00Z" };
  const items = Array.from({ length: 4 }, (_, i) => `<item>
    <title><![CDATA[Note ${i + 1} & <checks> [example]]]></title>
    <link>https://jakeuj.com/test-${i + 1}.html</link>
    <pubDate>Tue, 27 Oct 2026 00:00:00 +0800</pubDate>
  </item>`).join("");
  const warnings = [];
  let rssResponse = () => new Response(`<rss><channel>${items}</channel></rss>`);
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://jakeuj.com/feed.xml") return rssResponse();
    if (url.startsWith("https://api.github.com/users/jakeuj/repos?")) {
      return Response.json(repos);
    }
    if (url === "https://api.github.com/users/jakeuj") return Response.json(user);
    throw new Error(`Unexpected request: ${url}`);
  };
  console.warn = (message) => warnings.push(message);
  const stripPosts = (content) => content.replace(
    /<!-- BLOG-POST-LIST:START -->[\s\S]*?<!-- BLOG-POST-LIST:END -->/, "<posts>",
  );
  try {
    process.chdir(directory);
    await writeFile("README.md", readme);
    await t.test("generates six complete curated cards and updates only the RSS block", async () => {
      await updateProfile();
      const next = await readFile("README.md", "utf8");
      assert.equal(stripPosts(next), stripPosts(readme));
      assert.match(next, /Note 1 & <checks> \\\[example\\\]/);
      assert.match(next, /2026-10-27/); // Taipei midnight must not shift to October 26.
      assert.match(next, /test-3\.html/);
      assert.doesNotMatch(next, /test-4\.html/);
      const files = await readdir("assets");
      assert.equal(files.filter((name) => name.startsWith("project-")).length, 6);
      for (const file of files.filter((name) => name.startsWith("project-"))) {
        const svg = await readFile(join("assets", file), "utf8");
        assert.doesNotMatch(svg, /★|⑂|pushed|Remote description|…/);
        assert.match(svg, /prefers-reduced-motion/);
      }
      const stats = await readFile("assets/github-stats.svg", "utf8");
      assert.match(stats, /Years on GitHub/);
      assert.match(stats, /Latest repository activity/);
      assert.match(stats, /Repo&lt;&amp;&quot;/);
      assert.doesNotMatch(stats, /Years building|Currently building/);
    });
    for (const [name, response] of [
      ["HTTP failure", () => new Response("unavailable", { status: 503 })],
      ["network failure", () => { throw new Error("offline"); }],
      ["unusable feed", () => new Response("<rss><channel/></rss>")],
    ]) {
      await t.test(`preserves the entire README on RSS ${name}`, async () => {
        const before = await readFile("README.md", "utf8");
        rssResponse = response;
        const warningCount = warnings.length;
        await updateProfile();
        assert.equal(await readFile("README.md", "utf8"), before);
        assert.equal(warnings.length, warningCount + 1);
        assert.match(warnings.at(-1), /Recent posts unchanged/);
      });
    }
  } finally {
    process.chdir(originalCwd);
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    await rm(directory, { recursive: true, force: true });
  }
});
