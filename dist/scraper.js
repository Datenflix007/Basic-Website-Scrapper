"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeUrl = analyzeUrl;
exports.scrapeAreas = scrapeAreas;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const BUILTIN_AREAS = [
    { id: "h1", name: "H1-Überschriften", selector: "h1", description: "Hauptüberschriften der Seite", category: "text" },
    { id: "h2", name: "H2-Überschriften", selector: "h2", description: "Unterüberschriften", category: "text" },
    { id: "h3", name: "H3-Überschriften", selector: "h3", description: "Dritte Überschriftsebene", category: "text" },
    { id: "paragraphs", name: "Absätze", selector: "p", description: "Textabsätze (min. 30 Zeichen)", category: "text" },
    { id: "links", name: "Alle Links", selector: "a[href]", description: "Hyperlinks mit href-Attribut", category: "link" },
    { id: "external_links", name: "Externe Links", selector: "a[href^='http']", description: "Links zu externen Webseiten", category: "link" },
    { id: "images", name: "Bilder", selector: "img", description: "Bilder mit src und alt-Text", category: "media" },
    { id: "tables", name: "Tabellen", selector: "table", description: "HTML-Tabellen mit Inhalten", category: "table" },
    { id: "lists", name: "Listen", selector: "ul li, ol li", description: "Listeneinträge (ul/ol)", category: "text" },
    { id: "meta", name: "Meta-Tags", selector: "meta", description: "Meta-Informationen im Head", category: "meta" },
    { id: "nav", name: "Navigation", selector: "nav a, header a", description: "Navigationselemente", category: "link" },
    { id: "buttons", name: "Buttons", selector: "button, input[type='submit'], input[type='button']", description: "Klickbare Schaltflächen", category: "text" },
    { id: "article", name: "Artikel-Inhalt", selector: "article p, main p, .content p, #content p", description: "Texte im Hauptinhaltsbereich", category: "text" },
    { id: "prices", name: "Preise", selector: "[class*='price'], [class*='preis'], [itemprop='price']", description: "Preisangaben auf der Seite", category: "number" },
    { id: "time", name: "Zeitangaben", selector: "time, [datetime]", description: "Datum- und Zeitangaben", category: "text" },
    { id: "emails", name: "E-Mail-Adressen", selector: "a[href^='mailto']", description: "E-Mail-Links", category: "link" },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractItem($el, area, index) {
    const el = $el[0];
    if (!el)
        return null;
    if (area.id === "links" || area.id === "external_links" || area.id === "nav" || area.id === "emails") {
        const href = $el.attr("href") || "";
        const text = $el.text().trim();
        if (!href)
            return null;
        return { index, value: href, extra: text ? { text } : undefined };
    }
    if (area.id === "images") {
        const src = $el.attr("src") || "";
        const alt = $el.attr("alt") || "";
        if (!src)
            return null;
        return { index, value: src, extra: alt ? { alt } : undefined };
    }
    if (area.id === "meta") {
        const name = $el.attr("name") || $el.attr("property") || $el.attr("http-equiv") || "";
        const content = $el.attr("content") || "";
        if (!name || !content)
            return null;
        return { index, value: content, extra: { name } };
    }
    if (area.id === "time") {
        const dt = $el.attr("datetime") || "";
        const text = $el.text().trim();
        const val = dt || text;
        if (!val)
            return null;
        return { index, value: val, extra: dt && text ? { text } : undefined };
    }
    if (area.id === "tables") {
        const rows = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $el.find("tr").each((_, tr) => {
            const cells = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cheerio.load(tr)("td, th").each((_i, cell) => {
                cells.push(cheerio.load(cell)("td, th").first().text().trim());
            });
            if (cells.length)
                rows.push(cells.join(" | "));
        });
        const val = rows.slice(0, 5).join(" → ");
        if (!val)
            return null;
        return { index, value: val };
    }
    const text = $el.text().trim().replace(/\s+/g, " ");
    if (!text)
        return null;
    if (area.id === "paragraphs" && text.length < 30)
        return null;
    return { index, value: text.length > 300 ? text.slice(0, 300) + "…" : text };
}
async function analyzeUrl(url) {
    const { data: html } = await axios_1.default.get(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BasicScraper/1.0)" },
        maxContentLength: 5 * 1024 * 1024,
    });
    const $ = cheerio.load(html);
    const title = $("title").first().text().trim() || url;
    const areas = BUILTIN_AREAS.map((area) => {
        const count = $(area.selector).length;
        return { ...area, count };
    }).filter((a) => a.count > 0);
    return { url, title, areas };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCustomItem($el, index) {
    if (!$el[0])
        return null;
    const href = $el.attr("href");
    if (href) {
        const text = $el.text().trim();
        return { index, value: href, extra: text ? { text } : undefined };
    }
    const text = $el.text().trim().replace(/\s+/g, " ");
    if (!text)
        return null;
    return { index, value: text.length > 300 ? text.slice(0, 300) + "…" : text };
}
async function scrapeAreas(url, areaIds, customAreas = []) {
    const { data: html } = await axios_1.default.get(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; BasicScraper/1.0)" },
        maxContentLength: 5 * 1024 * 1024,
    });
    const $ = cheerio.load(html);
    const results = [];
    for (const id of areaIds) {
        const area = BUILTIN_AREAS.find((a) => a.id === id);
        if (!area)
            continue;
        const items = [];
        let index = 0;
        $(area.selector).each((_, el) => {
            if (items.length >= 100)
                return false;
            const item = extractItem($(el), area, ++index);
            if (item)
                items.push(item);
        });
        results.push({
            areaId: area.id,
            areaName: area.name,
            selector: area.selector,
            items,
            scrapedAt: new Date().toISOString(),
        });
    }
    for (const custom of customAreas) {
        const items = [];
        let index = 0;
        $(custom.selector).each((_, el) => {
            if (items.length >= 100)
                return false;
            const item = extractCustomItem($(el), ++index);
            if (item)
                items.push(item);
        });
        results.push({
            areaId: custom.id,
            areaName: custom.name,
            selector: custom.selector,
            items,
            scrapedAt: new Date().toISOString(),
        });
    }
    return results;
}
