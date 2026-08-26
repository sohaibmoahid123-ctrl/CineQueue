// ============================================================
// decryptor.js  —  شبیه‌ساز Makima / 1Shows / Viduki
// ============================================================

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function allocAndWrite(wasmExports, allocFn, data) {
  const ptr = wasmExports[allocFn](data.length);
  new Uint8Array(wasmExports.memory.buffer).set(data, ptr);
  return { ptr, len: data.length };
}

async function loadMakimaDL() {
  const manifest = await fetch("/api-1shows/makimaDL-manifest.json", { cache: "no-store" }).then(r => r.json());
  const wasmBuffer = await fetch("/api-1shows" + manifest.url, { cache: "force-cache" }).then(r => r.arrayBuffer());

  const { instance } = await WebAssembly.instantiate(wasmBuffer, {
    env: { abort: () => { throw new Error("wasm abort"); } }
  });

  return { exports: instance.exports, map: manifest.exports };
}

async function decryptDownload(encrypted, token) {
  const { exports, map } = await loadMakimaDL();

  const tokenBytes = hexToBytes(token);
  const ivBytes    = hexToBytes(encrypted.iv);
  const ctBytes    = hexToBytes(encrypted.ct);
  const tagBytes   = hexToBytes(encrypted.tag);

  const tokenMem = allocAndWrite(exports, map.alloc, tokenBytes);
  const ivMem    = allocAndWrite(exports, map.alloc, ivBytes);
  const ctMem    = allocAndWrite(exports, map.alloc, ctBytes);
  const tagMem   = allocAndWrite(exports, map.alloc, tagBytes);

  const outPtr = exports[map.alloc](ctBytes.length);

  const decryptedLen = exports[map.decryptDownload](
    tokenMem.ptr, tokenMem.len,
    ivMem.ptr,    ivMem.len,
    ctMem.ptr,    ctMem.len,
    tagMem.ptr,   tagMem.len,
    outPtr
  );

  if (decryptedLen < 0) {
    exports[map.reset]();
    throw new Error("makimaDL decrypt failed");
  }

  const result = new Uint8Array(exports.memory.buffer, outPtr, decryptedLen);
  const jsonStr = new TextDecoder().decode(result);
  exports[map.reset]();

  return JSON.parse(jsonStr);
}

export async function getDownloadSources(path) {
  // ۱. گرفتن توکن
  const tokenRes = await fetch("/api/viduki-token", { cache: "no-store" });
  if (!tokenRes.ok) throw new Error("token fetch failed");
  const { token } = await tokenRes.json();

  // ۲. گرفتن داده رمزشده
  const dataRes = await fetch(`/api/viduki-download?path=${encodeURIComponent(path)}&token=${token}`, {
    cache: "no-store"
  });

  const data = await dataRes.json();

  if (dataRes.status === 404 || data?.error) return { sources: [] };
  if (!data || typeof data.ct !== "string") throw new Error("unexpected download response shape");

  // ۳. رمزگشایی با WASM
  return await decryptDownload(data, token);
}

// تابع اصلی که دکمه سرور دوم صداش می‌زنه
export async function handleNewServerDownload(showId) {
  const season = document.getElementById('new-season-select').value;
  const episode = document.getElementById('new-episode-select').value;
  const resultsDiv = document.getElementById('new-server-results');
  const btn = document.getElementById('new-server-btn');

  resultsDiv.innerHTML = '<p style="color: #aaa; text-align: center;">⏳ Requesting token & decrypting WASM...</p>';
  btn.disabled = true;

  try {
    const path = `/download/tv/${showId}/${season}/${episode}`;
    
    const data = await getDownloadSources(path);
    const sources = data.sources || data;

    if (Array.isArray(sources) && sources.length > 0) {
      resultsDiv.innerHTML = sources.map(src => `
        <a href="${src.url || src.file}" target="_blank" rel="noopener noreferrer" 
           style="display: block; background: #161d2f; color: #2a9d8f; text-align: center; padding: 10px; margin-top: 8px; border-radius: 6px; text-decoration: none; font-weight: bold; border: 1px solid #324163;">
           💾 Download ${src.quality || src.label || 'HD'}
        </a>
      `).join('');
    } else {
      resultsDiv.innerHTML = '<p style="color: #ff6b6b; text-align: center;">No links returned from Viduki server.</p>';
    }
  } catch (err) {
    console.error("Decrypter Error:", err);
    resultsDiv.innerHTML = `<p style="color: #ff6b6b; text-align: center;">Error: ${err.message}</p>`;
  } finally {
    btn.disabled = false;
  }
}

// تابع اختصاصی برای دانلود فیلم‌ها
export async function handleMovieServer2Download(movieId) {
  const resultsDiv = document.getElementById('new-server-results');
  const btn = document.getElementById('new-server-btn');

  if (!resultsDiv) return;

  resultsDiv.innerHTML = '<p style="color: #aaa; text-align: center;">⏳ Requesting token & decrypting movie...</p>';
  if (btn) btn.disabled = true;

  try {
    const path = `/download/movie/${movieId}`;
    const data = await getDownloadSources(path);
    const sources = data.sources || data;

    if (Array.isArray(sources) && sources.length > 0) {
      resultsDiv.innerHTML = sources.map(src => `
        <a href="${src.url || src.file || src}" target="_blank" rel="noopener noreferrer" 
           style="display: block; background: #161d2f; color: #2a9d8f; text-align: center; padding: 10px; border-radius: 8px; margin-top: 8px; text-decoration: none; font-weight: bold;">
          💾 Download ${src.quality || src.label || 'HD'}
        </a>
      `).join('');
    } else {
      resultsDiv.innerHTML = '<p style="color: #ff6b6b; text-align: center;">No links returned for this movie.</p>';
    }
  } catch (err) {
    console.error("Movie Decrypter Error:", err);
    resultsDiv.innerHTML = `<p style="color: #ff6b6b; text-align: center;">Error: ${err.message}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// برای اینکه از HTML بشه صداشون زد
window.handleNewServerDownload = handleNewServerDownload;
window.handleMovieServer2Download = handleMovieServer2Download;
