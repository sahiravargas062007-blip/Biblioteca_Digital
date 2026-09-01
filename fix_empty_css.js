const fs = require('fs');
const file = 'C:\\Biblioteca_Digital\\public\\css\\user.css';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /\.empty-state-title\s*\{\s*font-family:\s*"Playfair Display",\s*serif;\s*font-size:\s*2rem;\s*color:\s*#fff;/s,
    `.empty-state-title {
    font-family: "Playfair Display", serif;
    font-size: 2rem;
    color: #146c5f;`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated user.css");
