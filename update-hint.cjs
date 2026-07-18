const fs = require('fs');
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `مثال: <code className="font-mono text-gray-400">llama3.2-vision</code> أو <code className="font-mono text-gray-400">minicpm-v</code> أو <code className="font-mono text-gray-400">qwen2.5:7b</code>`;
const replaceStr = `هام للغة العربية: يُفضل بشدة استخدام <code className="font-mono text-amber-400">minicpm-v</code> أو <code className="font-mono text-amber-400">qwen2-vl</code> لأن llama3 يخطئ كثيراً في العربية.`;

appTsx = appTsx.replace(targetStr, replaceStr);

fs.writeFileSync('src/App.tsx', appTsx);
console.log("Hint updated");
