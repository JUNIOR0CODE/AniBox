// ==JiruHubExtension==
// @name         AniBox Latino
// @version      v1.0.4
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

// Lista de extensiones de video compatibles con reproducción directa
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

  // Función auxiliar para asegurar URLs absolutas
  _ensureAbsoluteUrl(url) {
    if (!url) return "";
    url = url.trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    // Si no tiene protocolo, asumimos https
    return "https://" + url;
  }

  async watch(url) {
    console.log("[AniBox] URL recibida para reproducir:", url);

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    };

    // --- LÓGICA PARA STREAMTAPE ---
    if (url.includes("streamtape.com")) {
      try {
        // Asegurar URL absoluta antes de hacer la petición
        const streamPageUrl = this._ensureAbsoluteUrl(url);
        console.log("[AniBox] Solicitando página de Streamtape:", streamPageUrl);
        const pageHtml = await this.request(streamPageUrl);

        // Buscar la URL real del video (método más fiable)
        // Opción 1: script que asigna innerHTML a un elemento con id 'ideooolink'
        let videoUrl = null;
        const matchScript = pageHtml.match(/getElementById\('ideooolink'\)\.innerHTML = "([^"]+)"/);
        if (matchScript && matchScript[1]) {
          videoUrl = matchScript[1];
          console.log("[AniBox] URL encontrada con método 1:", videoUrl);
        } else {
          // Opción 2: buscar cualquier URL que termine en .mp4
          const matchMp4 = pageHtml.match(/https?:\/\/[^\s"']+\.mp4/);
          if (matchMp4 && matchMp4[0]) {
            videoUrl = matchMp4[0];
            console.log("[AniBox] URL encontrada con método 2:", videoUrl);
          }
        }

        if (videoUrl) {
          // Asegurar que la URL del video sea absoluta (ya debería serlo)
          const finalUrl = this._ensureAbsoluteUrl(videoUrl);
          return {
            type: "mp4",
            url: finalUrl,
            tryProxyUrl: true,  // Evita errores de SSL / contenido mixto
            headers: headers,
            subtitles: []
          };
        } else {
          console.log("[AniBox] No se pudo extraer la URL del video de Streamtape");
        }
      } catch (error) {
        console.log("[AniBox] Error al procesar Streamtape:", error);
      }
    }
    // --- FIN DE LA LÓGICA PARA STREAMTAPE ---

    // Para el resto de URLs, normalizamos y detectamos formato
    const normalUrl = this._ensureAbsoluteUrl(url);
    const urlLower = normalUrl.toLowerCase();

    // Soporte para HLS (m3u8)
    if (urlLower.endsWith(".m3u8")) {
      return {
        type: "hls",
        url: normalUrl,
        headers: headers,
        subtitles: []
      };
    }

    // Soporte para formatos de video directos (MP4, MKV, etc.)
    for (const ext of VIDEO_EXTENSIONS) {
      if (urlLower.endsWith(ext)) {
        return {
          type: "mp4",
          url: normalUrl,
          headers: headers,
          subtitles: []
        };
      }
    }

    // Si no se reconoce, intentar como MP4 directo (puede fallar si no es un video)
    return {
      type: "mp4",
      url: normalUrl,
      headers: headers,
      subtitles: []
    };
  }
}