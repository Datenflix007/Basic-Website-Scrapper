import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { analyzeUrl, scrapeAreas } from "./scraper";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Analyze endpoint: detect scrapable areas
app.post("/api/analyze", async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url || !url.startsWith("http")) {
    res.status(400).json({ error: "Gültige URL mit http:// oder https:// erforderlich." });
    return;
  }
  try {
    const result = await analyzeUrl(url);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    res.status(500).json({ error: `Analyse fehlgeschlagen: ${msg}` });
  }
});

// Scrape endpoint: extract selected areas
app.post("/api/scrape", async (req: Request, res: Response) => {
  const { url, areaIds } = req.body as { url?: string; areaIds?: string[] };
  if (!url || !url.startsWith("http")) {
    res.status(400).json({ error: "Gültige URL erforderlich." });
    return;
  }
  if (!Array.isArray(areaIds) || areaIds.length === 0) {
    res.status(400).json({ error: "Mindestens einen Bereich auswählen." });
    return;
  }
  try {
    const results = await scrapeAreas(url, areaIds);
    res.json({ results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    res.status(500).json({ error: `Scraping fehlgeschlagen: ${msg}` });
  }
});

// Export as JSON
app.post("/api/export", async (req: Request, res: Response) => {
  const { results, url } = req.body as { results: unknown; url: string };
  const filename = `scrape-${new URL(url).hostname}-${Date.now()}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify({ url, exportedAt: new Date().toISOString(), results }, null, 2));
});

app.listen(PORT, () => {
  console.log(`\n🕷️  Basic Website Scraper läuft auf http://localhost:${PORT}\n`);
});

export default app;
