"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const scraper_1 = require("./scraper");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, "../public")));
// Analyze endpoint: detect scrapable areas
app.post("/api/analyze", async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith("http")) {
        res.status(400).json({ error: "Gültige URL mit http:// oder https:// erforderlich." });
        return;
    }
    try {
        const result = await (0, scraper_1.analyzeUrl)(url);
        res.json(result);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        res.status(500).json({ error: `Analyse fehlgeschlagen: ${msg}` });
    }
});
// Scrape endpoint: extract selected areas
app.post("/api/scrape", async (req, res) => {
    const { url, areaIds } = req.body;
    if (!url || !url.startsWith("http")) {
        res.status(400).json({ error: "Gültige URL erforderlich." });
        return;
    }
    if (!Array.isArray(areaIds) || areaIds.length === 0) {
        res.status(400).json({ error: "Mindestens einen Bereich auswählen." });
        return;
    }
    try {
        const results = await (0, scraper_1.scrapeAreas)(url, areaIds);
        res.json({ results });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        res.status(500).json({ error: `Scraping fehlgeschlagen: ${msg}` });
    }
});
// Export as JSON
app.post("/api/export", async (req, res) => {
    const { results, url } = req.body;
    const filename = `scrape-${new URL(url).hostname}-${Date.now()}.json`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ url, exportedAt: new Date().toISOString(), results }, null, 2));
});
app.listen(PORT, () => {
    console.log(`\n🕷️  Basic Website Scraper läuft auf http://localhost:${PORT}\n`);
});
exports.default = app;
