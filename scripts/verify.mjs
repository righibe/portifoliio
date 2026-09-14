// Smoke-test the exported site in a real browser: engine boot, sections,
// About panel, language toggle and the spaceship game.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:8347";
const shots = "scripts/shots";
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text());
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // let the canvas boot + fonts settle

// 1. Engine booted?
const booted = await page.evaluate(() => window.__neuralEngineInit === true);
console.log(booted ? "OK engine booted" : "FAIL engine did not boot");
await page.screenshot({ path: `${shots}/1-hero.png` });

// 2. Open About via nav
await page.click('[data-section="about"]');
await page.waitForTimeout(1600);
const aboutVisible = await page.evaluate(() => {
  const p = document.getElementById("section-panel");
  return p.classList.contains("active") && !!p.querySelector(".note-board");
});
console.log(aboutVisible ? "OK about panel + note board" : "FAIL about panel");
const familyCard = await page.evaluate(() =>
  document.querySelector(".note--family")?.textContent?.includes("Rodrigo")
);
const noPercent = await page.evaluate(() => !document.querySelector(".pstat, .player-card"));
console.log(noPercent ? "OK no RPG percentages" : "FAIL RPG stats still present");
const hasQuote = await page.evaluate(() => {
  const q = document.querySelector(".note--quote");
  return !!q && !!q.querySelector(".quote-shuriken svg") &&
    q.textContent.includes("Kakashi") && q.textContent.includes("Naruto");
});
console.log(hasQuote ? "OK kakashi quote + shuriken + source" : "FAIL quote card");
console.log(familyCard ? "OK family card mentions dad" : "FAIL family card");
await page.screenshot({ path: `${shots}/2-about.png` });

// 3. Language toggle → PT
await page.click('[data-lang="pt"]');
await page.waitForTimeout(900);
const ptOk = await page.evaluate(() =>
  document.querySelector(".note--family")?.textContent?.includes("pesquisador")
);
console.log(ptOk ? "OK PT translation" : "FAIL PT translation");
await page.screenshot({ path: `${shots}/3-about-pt.png` });

// 4. Other sections render
for (const key of ["journey", "skills", "leadership", "projects", "contact"]) {
  await page.click(`[data-section="${key}"]`);
  await page.waitForTimeout(900);
  const hasContent = await page.evaluate(
    () => document.getElementById("panel-content").children.length > 0
  );
  console.log((hasContent ? "OK " : "FAIL ") + "section " + key);
}
await page.screenshot({ path: `${shots}/4-projects.png` });

// 5. Back home, then start the spaceship game (secret node at ~88%, 84%)
await page.click("#panel-close");
await page.waitForTimeout(1200);
const vp = page.viewportSize();
await page.mouse.click(vp.width * 0.88, vp.height * 0.84);
await page.waitForTimeout(1500);
const gameOn = await page.evaluate(() =>
  document.getElementById("explore-hud").classList.contains("active")
);
console.log(gameOn ? "OK spaceship game started" : "FAIL spaceship game");
if (gameOn) {
  // fly + shoot a bit
  await page.keyboard.down("d");
  await page.keyboard.press("Space");
  await page.waitForTimeout(900);
  await page.keyboard.up("d");
  await page.screenshot({ path: `${shots}/5-game.png` });
}

console.log(errors.length ? "JS ERRORS:\n" + errors.join("\n") : "OK no JS errors");
await browser.close();
process.exit(errors.length || !booted ? 1 : 0);
