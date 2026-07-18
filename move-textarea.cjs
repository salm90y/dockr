const fs = require('fs');

let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Find the documentContent block
const docContentStart = appTsx.indexOf('<div className="col-span-1 md:col-span-2 space-y-1.5">', appTsx.indexOf('تفاصيل وثيقة الأرشفة / مضمون الكتاب'));
// Wait, the div starts a bit before.
// Looking at the grep output:
// 5113: <div className="col-span-1 md:col-span-2 space-y-1.5">
// 5114: <span className="text-[10px] text-[#d4af37] block font-black uppercase tracking-wider">تفاصيل وثيقة الأرشفة / مضمون الكتاب (تصميم حر بدون حدود أو صناديق مقيدة):</span>
// ...
// 5130: </div>

const startMarker = '<div className="col-span-1 md:col-span-2 space-y-1.5">\n                                  <span className="text-[10px] text-[#d4af37] block font-black uppercase tracking-wider">تفاصيل وثيقة الأرشفة / مضمون الكتاب';

let actualStart = appTsx.lastIndexOf('<div', appTsx.indexOf('تفاصيل وثيقة الأرشفة / مضمون الكتاب'));
let endMarker = 'placeholder="اكتب مضمون وتفاصيل الكتاب بحرية كاملة دون حدود للارتفاع أو خلفية مقيدة..."\n                                  />\n                                </div>';

let actualEnd = appTsx.indexOf(endMarker) + endMarker.length;

if (actualStart !== -1 && actualEnd !== -1) {
  let docContentBlock = appTsx.substring(actualStart, actualEnd);
  
  // Remove it from its current position
  appTsx = appTsx.substring(0, actualStart) + appTsx.substring(actualEnd);
  
  // Find where to insert it: after References block.
  // The References block ends around line 5321 with `)}</div></>` or similar.
  // We can insert it before `{/* Digital sealing / verification QR Code */}`
  
  const insertMarker = '{/* Digital sealing / verification QR Code */}';
  const insertIndex = appTsx.indexOf(insertMarker);
  
  if (insertIndex !== -1) {
    appTsx = appTsx.substring(0, insertIndex) + docContentBlock + '\n\n                            ' + appTsx.substring(insertIndex);
    fs.writeFileSync('src/App.tsx', appTsx);
    console.log("Moved textarea successfully.");
  } else {
    console.log("Could not find insert marker.");
  }
} else {
  console.log("Could not find block boundaries.");
}
