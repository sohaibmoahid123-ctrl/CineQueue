// ============================================================
// moviesmod.js  —  جستجو و نمایش لینک‌های MoviesMod
// ============================================================

function getMoviesModLink(title, isTv = false, season = null, episode = null) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (isTv && season && episode) {
    return `https://moviesmod.zone/${slug}-season-${season}-episode-${episode}`;
  }
  return `https://moviesmod.zone/?s=${encodeURIComponent(title)}`;
}

export async function showDownloadPage(title, isTv = false, season = null, episode = null) {
  let container = document.getElementById('moviesmod-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'moviesmod-container';
    container.style.cssText = 'margin-top: 20px; border-radius: 12px; overflow: hidden; background: #000;';
    
    const downloadSection = document.querySelector('.download-section');
    if (downloadSection) {
      downloadSection.appendChild(container);
    } else {
      const detailContent = document.querySelector('.detail-content');
      if (detailContent) detailContent.appendChild(container);
    }
  }

  container.innerHTML = `
    <div style="background: #161d2f; padding: 15px; border-radius: 8px; color: #fff; text-align: center;">
      <p style="margin: 0;">⌛ Searching available links for "${title}"...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/available-qualities?url=${encodeURIComponent(title)}`);
    const data = await res.json();

    if (data.success && data.options && data.options.length > 0) {
      let buttonsHtml = data.options.map(opt => `
        <button onclick="window.open('${opt.link}', '_blank')"
                style="background: #10b981; color: white; border: none; padding: 10px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; text-align: left; width: 100%;">
          ⚡ Download ${opt.label}
        </button>
      `).join('');

      container.innerHTML = `
        <div style="background: #161d2f; padding: 15px; border-radius: 8px; border: 1px solid #2e3856;">
          <p style="margin-top: 0; color: #9ca3af; font-size: 0.9rem; margin-bottom: 12px;">Select Quality / Option:</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${buttonsHtml}
          </div>
        </div>
      `;
    } else {
      const fallbackUrl = getMoviesModLink(title, isTv, season, episode);
      container.innerHTML = `
        <div style="position: relative; padding-top: 56.25%; background: #0a0e1a;">
          <iframe 
            src="${fallbackUrl}" 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
            allowfullscreen>
          </iframe>
        </div>
        <div style="text-align: center; padding: 10px; background: #0f1629; color: #888; font-size: 0.85rem; border-top: 1px solid #232d45;">
          ⚠️ Direct links unavailable. <a href="${fallbackUrl}" target="_blank" style="color: #e50914; text-decoration: none;">Click here to view on MoviesMod</a>
        </div>
      `;
    }
  } catch (err) {
    const fallbackUrl = getMoviesModLink(title, isTv, season, episode);
    container.innerHTML = `
      <div style="background: #161d2f; padding: 15px; border-radius: 8px; color: #ef4444; text-align: center;">
        ❌ Scraper error. <a href="${fallbackUrl}" target="_blank" style="color: #e50914; text-decoration: underline;">Open Search directly</a>
      </div>
    `;
  }
  
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// برای اینکه از HTML بشه صداش زد
window.showDownloadPage = showDownloadPage;
