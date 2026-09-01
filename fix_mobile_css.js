const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\public\\css\\pages\\audio-player.css';
let content = fs.readFileSync(file, 'utf8');

// Replace mobile side-panel css to slide from bottom
const oldCss = `.ap-side-panel {
    width: 100%;
    right: -100%;
  }`;
const newCss = `.ap-side-panel {
    width: 100%;
    height: 60%;
    top: auto;
    bottom: -100%;
    right: 0;
    border-left: none;
    border-top: 1px solid rgba(20, 108, 95, 0.3);
    border-radius: 20px 20px 0 0;
    transition: bottom 0.3s ease;
  }
  .ap-side-panel.open {
    bottom: 0;
    right: 0;
  }`;

content = content.replace(oldCss, newCss);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated audio-player.css");
