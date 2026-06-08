// ==JiruHubExtension==
// @name         AniBox Latino
// @version      v1.0.2
// @author       JUNIOR0CODE
// @lang         es
// @license      MIT
// @icon         https://raw.githubusercontent.com/JUNIOR0CODE/AniBox/main/icons/app.png
// @package      anibox
// @type         bangumi
// @webSite      https://anibox.junior0dev.qzz.io
// @nsfw         false
// ==/JiruHubExtension==

const API_URL = "https://raw.githubusercontent.com/JUNIOR0CODE/AniBox/main/extensions/anime_db.json";
const PAGE_SIZE = 20;

// Lista de extensiones de video compatibles con reproducción directa como MP4
const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"];

export default class extends Extension {
  constructor() {
    super();
    this.animeList = null;
  }

  async load() {
    if (this.animeList) return this.animeList;
    try {
      const raw = await this.request("", { headers: { "Miru-Url": API_URL } });
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      this.animeList = (data && Array.isArray(data.animes)) ? data.animes : [];
      return this.animeList;
    } catch {
      this.animeList = [];
      return this.animeList;
    }
  }

  async latest(page) {
    const list = await this.load();
    const p = Math.max(1, parseInt(page) || 1);
    const start = (p - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE).map(a => ({
      title: a.title,
      url: a.id,
      cover: a.cover
    }));
  }

  async search(kw, page) {
    const list = await this.load();
    const q = (kw || "").toLowerCase().trim();
    if (!q) return [];
    const filtered = list.filter(a => {
      const title = (a.title || "").toLowerCase();
      const genres = (a.genres || "").toLowerCase();
      const desc = (a.description || "").toLowerCase();
      return title.includes(q) || genres.includes(q) || desc.includes(q);
    });
    const p = Math.max(1, parseInt(page) || 1);
    const start = (p - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE).map(a => ({
      title: a.title,
      url: a.id,
      cover: a.cover
    }));
  }

  async detail(id) {
    const list = await this.load();
    const anime = list.find(a => a.id === id);
    if (!anime) return { title: "No encontrado", cover: "", desc: "", episodes: [] };
    let episodesOut = [];
    if (Array.isArray(anime.episodes)) {
      if (anime.episodes.length === 1 && anime.episodes[0].title === "Capitulos") {
        episodesOut = [{
          title: "Capitulos",
          urls: anime.episodes[0].urls.map(ep => ({ name: ep.name, url: ep.url }))
        }];
      } else {
        episodesOut = anime.episodes.map(season => ({
          title: season.title,
          urls: season.urls.map(ep => ({ name: ep.name, url: ep.url }))
        }));
      }
    }
    return { title: anime.title, cover: anime.cover, desc: anime.description || "", episodes: episodesOut };
  }

  async watch(url) {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    };

    // Determinar el tipo de video basado en la extensión del archivo
    const urlLower = url.toLowerCase();

    // Soporte para HLS (m3u8)
    if (urlLower.endsWith(".m3u8")) {
      return {
        type: "hls",
        url: url,
        headers: headers,
        subtitles: []
      };
    }

    // Soporte para formatos de video directos (MP4, MKV, AVI, MOV, WebM, FLV, WMV)
    for (const ext of VIDEO_EXTENSIONS) {
      if (urlLower.endsWith(ext)) {
        return {
          type: "mp4",
          url: url,
          headers: headers,
          subtitles: []
        };
      }
    }

    // Si no se reconoce la extensión, intentar como MP4 (por si acaso)
    return {
      type: "mp4",
      url: url,
      headers: headers,
      subtitles: []
    };
  }
}