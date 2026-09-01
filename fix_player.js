const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\views\\user\\archivo\\ver.ejs';
let content = fs.readFileSync(file, 'utf8');

// 1. Add "Lista de reproducción" button and fix record cover
content = content.replace(
    /<div class="ap-side-toggles">\s*<button id="btn-info" class="ap-toggle-btn">.*?<\/span>\s*<\/button>\s*<\/div>/s,
    `<div class="ap-side-toggles">
      <button id="btn-info" class="ap-toggle-btn">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
        <span>Información</span>
      </button>
      <button id="btn-playlist-toggle" class="ap-toggle-btn">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        <span>Lista de reproducción</span>
      </button>
    </div>`
);

// Check if image path is recurso.imagen_url or recurso.imagen.url
// In ver.ejs: <img src="<%= recurso.imagen_url %>" class="portada" alt="Portada">
// We should change it to use recurso.imagen?.url || recurso.imagen_url
content = content.replace(
    /<img src="<%= recurso\.imagen_url %>" class="portada" alt="Portada">/g,
    `<img src="<%= recurso.imagen?.url || recurso.imagen_url %>" class="portada" alt="Portada">`
);
content = content.replace(
    /<% if \(recurso\.imagen_url\) \{ %>/g,
    `<% if (recurso.imagen?.url || recurso.imagen_url) { %>`
);

// 2. Rewrite the JS logic for the player
const jsStart = content.indexOf('<script>\n  document.addEventListener("DOMContentLoaded", function() {\n    const audio = document.getElementById("native-audio");');
const jsEnd = content.indexOf('</script>\n\n  <% } else { %>');

if (jsStart !== -1 && jsEnd !== -1) {
    const newJs = `<script>
  document.addEventListener("DOMContentLoaded", function() {
    const audio = document.getElementById("native-audio");
    const playBtn = document.getElementById("btn-play-pause");
    const iconPlay = document.getElementById("icon-play");
    const iconPause = document.getElementById("icon-pause");
    const progressBar = document.getElementById("ap-progress-bar");
    const currentTimeEl = document.getElementById("ap-current-time");
    const durationEl = document.getElementById("ap-duration");
    const totalTimeEl = document.getElementById("ap-total-time");
    const btnBackward = document.getElementById("btn-backward");
    const btnForward = document.getElementById("btn-forward");
    const vinylDisc = document.getElementById("vinyl-disc");
    const volumeSlider = document.getElementById("ap-volume-slider");
    const btnInfo = document.getElementById("btn-info");
    const btnCloseInfo = document.getElementById("btn-close-info");
    const sidePanel = document.getElementById("ap-side-panel");
    const btnPlaylistToggle = document.getElementById("btn-playlist-toggle");
  
    const btnPrevChap = document.getElementById("btn-prev-chap");
    const btnNextChap = document.getElementById("btn-next-chap");
  
    let chapters = <%- JSON.stringify(recurso.digital?.archivos?.filter(a => a.tipo && (a.tipo.includes('mp3') || a.tipo.includes('wav') || a.tipo.includes('m4a') || a.tipo.includes('audio'))).sort((a,b) => (a.orden||0) - (b.orden||0)) || []) %>;
    if (chapters.length === 0 && "<%= archivo ? archivo.url : '' %>" !== "") {
      chapters = [{ url: "<%= archivo.url %>", nombre_capitulo: "Audio completo" }];
    }
    let currentChapterIndex = 0;
  
    function loadChapter(index) {
      if (chapters.length === 0) return;
      currentChapterIndex = index;
      audio.src = chapters[index].url;
      audio.load();
      audio.play().then(() => {
        iconPlay.style.display = "none";
        iconPause.style.display = "block";
        vinylDisc.classList.add("spinning");
      }).catch(e => {
        // Prevent DOM exception on initial load if not user initiated
        iconPlay.style.display = "block";
        iconPause.style.display = "none";
        vinylDisc.classList.remove("spinning");
      });
      
      document.querySelectorAll(".ap-playlist-item").forEach((el, i) => {
        if(i === index) {
            el.classList.add("active");
            el.style.backgroundColor = "rgba(20, 108, 95, 0.2)";
        } else {
            el.classList.remove("active");
            el.style.backgroundColor = "";
        }
      });
    }

    // Side Panels Logic
    // Create Playlist Panel dynamically
    const playlistPanel = document.createElement("aside");
    playlistPanel.className = "ap-side-panel";
    playlistPanel.id = "ap-playlist-panel";
    playlistPanel.innerHTML = \`
      <div class="ap-side-header">
        <h2>Lista de reproducción</h2>
        <button id="btn-close-playlist" class="ap-close-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="ap-side-content">
        <ul class="ap-playlist-list" style="list-style:none; padding:0; margin:0;">
          \${chapters.map((chap, i) => \`
            <li class="ap-playlist-item" data-index="\${i}" style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); cursor:pointer; display:flex; gap:1rem; align-items:center;">
              <span style="color:#146c5f; font-weight:bold;">\${(i+1).toString().padStart(2, '0')}</span>
              <span style="flex:1;">\${chap.nombre_capitulo || 'Capítulo ' + (i+1)}</span>
            </li>
          \`).join('')}
        </ul>
      </div>
    \`;
    sidePanel.parentNode.appendChild(playlistPanel);

    // Default: Open playlist
    playlistPanel.classList.add("open");

    document.querySelectorAll(".ap-playlist-item").forEach(item => {
      item.addEventListener("click", function() {
        loadChapter(parseInt(this.getAttribute("data-index")));
      });
    });

    document.getElementById("btn-close-playlist").addEventListener("click", () => {
      playlistPanel.classList.remove("open");
    });
    btnPlaylistToggle.addEventListener("click", () => {
      sidePanel.classList.remove("open");
      playlistPanel.classList.toggle("open");
    });

    btnInfo.addEventListener("click", () => { 
      playlistPanel.classList.remove("open");
      sidePanel.classList.toggle("open"); 
    });
    btnCloseInfo.addEventListener("click", () => { 
      sidePanel.classList.remove("open"); 
    });

    if(btnPrevChap) {
      btnPrevChap.addEventListener("click", () => {
        if(currentChapterIndex > 0) loadChapter(currentChapterIndex - 1);
      });
    }
    
    if(btnNextChap) {
      btnNextChap.addEventListener("click", () => {
        if(currentChapterIndex < chapters.length - 1) loadChapter(currentChapterIndex + 1);
      });
    }

    audio.addEventListener("ended", () => {
      if (currentChapterIndex < chapters.length - 1) {
        loadChapter(currentChapterIndex + 1);
      } else {
        iconPlay.style.display = "block";
        iconPause.style.display = "none";
        vinylDisc.classList.remove("spinning");
      }
    });

    function formatTime(seconds) {
      if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      if (h > 0) {
        return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
      }
      return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }

    audio.addEventListener("loadedmetadata", () => {
      durationEl.textContent = formatTime(audio.duration);
      progressBar.max = audio.duration;
    });

    audio.addEventListener("timeupdate", () => {
      currentTimeEl.textContent = formatTime(audio.currentTime);
      if(!progressBar.classList.contains("dragging")) {
        progressBar.value = audio.currentTime || 0;
        updateSliderProgress(progressBar);
      }
    });

    playBtn.addEventListener("click", () => {
      if (!audio.src) {
        loadChapter(0);
        return;
      }
      if (audio.paused) {
        audio.play();
        iconPlay.style.display = "none";
        iconPause.style.display = "block";
        vinylDisc.classList.add("spinning");
      } else {
        audio.pause();
        iconPlay.style.display = "block";
        iconPause.style.display = "none";
        vinylDisc.classList.remove("spinning");
      }
    });

    btnBackward.addEventListener("click", () => { audio.currentTime = Math.max(0, audio.currentTime - 15); });
    btnForward.addEventListener("click", () => { audio.currentTime = Math.min(audio.duration, audio.currentTime + 15); });

    progressBar.addEventListener("mousedown", () => progressBar.classList.add("dragging"));
    progressBar.addEventListener("mouseup", () => progressBar.classList.remove("dragging"));
    progressBar.addEventListener("input", (e) => {
      audio.currentTime = e.target.value;
      updateSliderProgress(e.target);
    });

    if (volumeSlider) {
        volumeSlider.addEventListener("input", (e) => {
        audio.volume = e.target.value;
        updateSliderProgress(e.target);
        });
        updateSliderProgress(volumeSlider);
    }

    function updateSliderProgress(slider) {
      const min = parseFloat(slider.min) || 0;
      const max = parseFloat(slider.max) || 100;
      const val = parseFloat(slider.value) || 0;
      const percentage = (max === min) ? 0 : (val - min) / (max - min) * 100;
      slider.style.setProperty('--progress', percentage + '%');
    }

    updateSliderProgress(progressBar);
    
    // Initialize first chapter if exists but don't auto-play
    if (chapters.length > 0) {
      audio.src = chapters[0].url;
      audio.load();
      document.querySelectorAll(".ap-playlist-item")[0].classList.add("active");
      document.querySelectorAll(".ap-playlist-item")[0].style.backgroundColor = "rgba(20, 108, 95, 0.2)";
    }
  });\n`;
    content = content.substring(0, jsStart) + newJs + content.substring(jsEnd);
    console.log("Updated Javascript block!");
} else {
    console.log("Could not find JS bounds");
}

fs.writeFileSync(file, content, 'utf8');
