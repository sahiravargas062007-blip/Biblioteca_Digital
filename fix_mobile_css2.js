const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\public\\css\\pages\\audio-player.css';
let content = fs.readFileSync(file, 'utf8');

// Replace mobile side-panel css to slide from bottom
content = content.replace(
    /\.ap-side-panel\s*\{\s*width:\s*100%;\s*right:\s*-100%;\s*\}/g,
    `.ap-side-panel {
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
  }`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated audio-player.css");
