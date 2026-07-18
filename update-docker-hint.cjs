const fs = require('fs');
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

appTsx = appTsx.replace('docker exec -it ollama ollama run llama3.2-vision', 'docker exec -it ollama ollama run minicpm-v');
appTsx = appTsx.replace('ollama run llama3.2-vision', 'ollama run minicpm-v');
appTsx = appTsx.replace('تأكد من كتابة اسم الموديل بالضبط <code className="text-[#d4af37] font-mono bg-black px-1 rounded">llama3.2-vision</code>', 'تأكد من كتابة اسم الموديل بالضبط <code className="text-[#d4af37] font-mono bg-black px-1 rounded">minicpm-v</code>');
appTsx = appTsx.replace('placeholder="llama3.2-vision"', 'placeholder="minicpm-v"');

fs.writeFileSync('src/App.tsx', appTsx);
console.log("Docker hint updated");
