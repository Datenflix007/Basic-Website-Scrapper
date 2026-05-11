import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapableArea {
  id: string;
  name: string;
  selector: string;
  description: string;
  category: "text" | "link" | "number" | "media" | "meta" | "table";
  count?: number;
}

export interface ScrapeResult {
  areaId: string;
  areaName: string;
  selector: string;
  items: ScrapeItem[];
  scrapedAt: string;
}

export interface ScrapeItem {
  index: number;
  value: string;
  extra?: Record<string, string>;
}

export interface CustomArea {
  id: string;
  name: string;
  selector: string;
  category: "text" | "link" | "number" | "media" | "meta" | "table";
}

export interface AnalyzeResponse {
  url: string;
  title: string;
  areas: ScrapableArea[];
}

const BUILTIN_AREAS: Array<Omit<ScrapableArea, "count">> = [
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
function extractItem($el: any, area: Omit<ScrapableArea, "count">, index: number): ScrapeItem | null {
  const el = $el[0];
  if (!el) return null;

  if (area.id === "links" || area.id === "external_links" || area.id === "nav" || area.id === "emails") {
    const href = $el.attr("href") || "";
    const text = $el.text().trim();
    if (!href) return null;
    return { index, value: href, extra: text ? { text } : undefined };
  }

  if (area.id === "images") {
    const src = $el.attr("src") || "";
    const alt = $el.attr("alt") || "";
    if (!src) return null;
    return { index, value: src, extra: alt ? { alt } : undefined };
  }

  if (area.id === "meta") {
    const name = $el.attr("name") || $el.attr("property") || $el.attr("http-equiv") || "";
    const content = $el.attr("content") || "";
    if (!name || !content) return null;
    return { index, value: content, extra: { name } };
  }

  if (area.id === "time") {
    const dt = $el.attr("datetime") || "";
    const text = $el.text().trim();
    const val = dt || text;
    if (!val) return null;
    return { index, value: val, extra: dt && text ? { text } : undefined };
  }

  if (area.id === "tables") {
    const rows: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $el.find("tr").each((_: number, tr: any) => {
      const cells: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cheerio.load(tr)("td, th").each((_i: number, cell: any) => {
        cells.push(cheerio.load(cell)("td, th").first().text().trim());
      });
      if (cells.length) rows.push(cells.join(" | "));
    });
    const val = rows.slice(0, 5).join(" → ");
    if (!val) return null;
    return { index, value: val };
  }

  const text = $el.text().trim().replace(/\s+/g, " ");
  if (!text) return null;

  if (area.id === "paragraphs" && text.length < 30) return null;

  return { index, value: text.length > 300 ? text.slice(0, 300) + "…" : text };
}

export async function analyzeUrl(url: string): Promise<AnalyzeResponse> {
  const { data: html } = await axios.get(url, {
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BasicScraper/1.0)" },
    maxContentLength: 5 * 1024 * 1024,
  });

  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || url;

  const areas: ScrapableArea[] = BUILTIN_AREAS.map((area) => {
    const count = $(area.selector).length;
    return { ...area, count };
  }).filter((a) => a.count > 0);

  return { url, title, areas };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCustomItem($el: any, index: number): ScrapeItem | null {
  if (!$el[0]) return null;
  const href = $el.attr("href");
  if (href) {
    const text = $el.text().trim();
    return { index, value: href, extra: text ? { text } : undefined };
  }
  const text = $el.text().trim().replace(/\s+/g, " ");
  if (!text) return null;
  return { index, value: text.length > 300 ? text.slice(0, 300) + "…" : text };
}

export async function scrapeAreas(url: string, areaIds: string[], customAreas: CustomArea[] = []): Promise<ScrapeResult[]> {
  const { data: html } = await axios.get(url, {
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; BasicScraper/1.0)" },
    maxContentLength: 5 * 1024 * 1024,
  });

  const $ = cheerio.load(html);
  const results: ScrapeResult[] = [];

  for (const id of areaIds) {
    const area = BUILTIN_AREAS.find((a) => a.id === id);
    if (!area) continue;

    const items: ScrapeItem[] = [];
    let index = 0;

    $(area.selector).each((_, el) => {
      if (items.length >= 100) return false;
      const item = extractItem($(el), area, ++index);
      if (item) items.push(item);
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
    const items: ScrapeItem[] = [];
    let index = 0;

    $(custom.selector).each((_, el) => {
      if (items.length >= 100) return false;
      const item = extractCustomItem($(el), ++index);
      if (item) items.push(item);
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
