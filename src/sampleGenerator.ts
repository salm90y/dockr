/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function generateSampleDocument(type: 'admin' | 'saudi' | 'board'): {
  base64: string;
  mimeType: string;
  fileName: string;
  fileSize: string;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 650;
  canvas.height = 850;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not supported');
  }

  // 1. Off-white/cream paper background
  ctx.fillStyle = '#faf8f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle paper texture / noise
  ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 3 + 1;
    ctx.fillRect(x, y, size, size);
  }

  // Draw elegant borders
  ctx.strokeStyle = '#8c7e65';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  
  ctx.strokeStyle = '#d4c5a9';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  // Setup text alignments and fonts
  ctx.textBaseline = 'top';

  if (type === 'admin') {
    // ---- Type 1: Iraq / Baghdad Univ Administrative Order ----
    // Top right header
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الجمهورية العراقية', canvas.width - 45, 50);
    ctx.fillText('وزارة التعليم العالي والبحث العلمي', canvas.width - 45, 72);
    ctx.fillText('جامعة بغداد - قسم الشؤون الإدارية', canvas.width - 45, 94);

    // Top left header
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('الرقم: ع / د / ١٢٩٨ / ب', 45, 50);
    ctx.fillText('التاريخ: ٢٤ مايو ٢٠٢٦ م', 45, 72);
    ctx.fillText('الموافق: ٧ ذو الحجة ١٤٤٧ هـ', 45, 94);

    // Logo / Crest Placeholder in Top Center
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 75, 25, 0, Math.PI * 2);
    ctx.stroke();
    // Inner emblem
    ctx.fillStyle = '#854d0e';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 75, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px system-ui, -apple-system, sans-serif';
    ctx.fillText('بـغـداد', canvas.width / 2, 71);

    // Divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 130);
    ctx.lineTo(canvas.width - 40, 130);
    ctx.stroke();

    // Document Title
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('أمر إداري رقم (١٢٩٨)', canvas.width / 2, 160);

    // Document Subject
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText('الموضوع: إيفاد وتكريم باحثين متميزين', canvas.width / 2, 195);

    // Document Body text
    ctx.textAlign = 'right';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#334155';
    
    const lines = [
      'بناءً على الصلاحيات المخولة لنا بموجب القانون الإداري النافذ، وموافقة السيد رئيس الجامعة',
      'المحترم في جلسته المنعقدة بتاريخ ٢٠٢٦/٠٥/١٠، قررنا ما يلي:',
      '',
      'أولاً: إيفاد السادة التدريسيين المدرجة أسماؤهم أدناه إلى جامعة كامبريدج للمشاركة في المؤتمر',
      'العلمي السنوي لتطبيقات الذكاء الاصطناعي لمدة سبعة أيام:',
      '  ١. الأستاذ الدكتور أحمد ياسين - كلية تكنولوجيا المعلومات (رئيساً للوفد)',
      '  ٢. المدرس المساعد مريم محمد فاضل - كلية الهندسة (عضواً)',
      '',
      'ثانياً: صرف الإيفاد والمستحقات المالية من ميزانية صندوق دعم البحث العلمي.',
      'ثالثاً: يُنفذ هذا الأمر اعتباراً من تاريخ صدوره، وعلى الجهات المعنية كافة اتخاذ ما يلزم.',
      '',
      'شاكرين لهم جهودهم المتميزة في رفع تصنيف الجامعة عالمياً.'
    ];

    let startY = 250;
    lines.forEach((line) => {
      ctx.fillText(line, canvas.width - 45, startY);
      startY += 26;
    });

    // Signature Title
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('الأستاذ الدكتور صلاح كمال مظهر', 45, 620);
    ctx.fillText('رئيس جامعة بغداد بالوكالة', 45, 642);

    // Draw Simulated Blue Ink Signature
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 560);
    ctx.bezierCurveTo(100, 550, 160, 590, 120, 600);
    ctx.bezierCurveTo(90, 610, 70, 570, 150, 580);
    ctx.stroke();

    // Draw Blue Official Seal
    ctx.strokeStyle = 'rgba(29, 78, 216, 0.65)';
    ctx.fillStyle = 'rgba(29, 78, 216, 0.03)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvas.width - 150, 640, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Inner dashed circle
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(canvas.width - 150, 640, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Text in seal
    ctx.fillStyle = 'rgba(29, 78, 216, 0.75)';
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.fillText('رئاسة جامعة بغداد', canvas.width - 150, 620);
    ctx.fillText('مكتب رئيس الجامعة', canvas.width - 150, 637);
    ctx.fillText('الختم المشترك', canvas.width - 150, 654);

  } else if (type === 'saudi') {
    // ---- Type 2: Saudi Ministry Direction ----
    // Top right header
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('المملكة العربية السعودية', canvas.width - 45, 50);
    ctx.fillText('وزارة الموارد البشرية والتنمية الاجتماعية', canvas.width - 45, 72);
    ctx.fillText('وكالة التمكين والتوظيف الإداري', canvas.width - 45, 94);

    // Top left header
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('الرقم: ٤٤٥ / أ / ٨٩١٢', 45, 50);
    ctx.fillText('التاريخ: ٢٠ صفر ١٤٤٧ هـ', 45, 72);
    ctx.fillText('المرفقات: كشف الملاك (٥ صفحات)', 45, 94);

    // Logo / Crest Placeholder in Top Center (Saudi Emblem Inspired)
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#15803d'; // Green
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Draw two crossed swords
    ctx.moveTo(canvas.width / 2 - 15, 60);
    ctx.lineTo(canvas.width / 2 + 15, 90);
    ctx.moveTo(canvas.width / 2 + 15, 60);
    ctx.lineTo(canvas.width / 2 - 15, 90);
    ctx.stroke();
    // Draw palm tree trunk
    ctx.strokeStyle = '#15803d';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 75);
    ctx.lineTo(canvas.width / 2, 55);
    ctx.stroke();
    // Palm leaves
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#15803d';
    ctx.fillText('🌴', canvas.width / 2, 45);

    // Divider
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(40, 130);
    ctx.lineTo(canvas.width - 40, 130);
    ctx.stroke();

    // Document Title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
    ctx.fillText('توجيه إداري وتحديث كشوفات الملاك المالي', canvas.width / 2, 160);

    // Document Subject
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('التعميم الإداري العاجل لجميع الهيئات والمكاتب الإقليمية بالمملكة', canvas.width / 2, 190);

    // Body
    ctx.textAlign = 'right';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#374151';

    const lines = [
      'إلى جميع أصحاب السعادة، مدراء المكاتب الفرعية والإقليمية المحترمين',
      'السلام عليكم ورحمة الله وبركاته، أما بعد:',
      '',
      'بناءً على التوجيه السامي الكريم القاضي بضرورة إعادة تنظيم كشوفات الملاك وتنسيق الكوادر الإدارية',
      'وتنمية الموارد البشرية تماشياً مع مستهدفات رؤية المملكة ٢٠٣٠ في تفعيل الأتمتة الإدارية:',
      '',
      '١. يُطلب من جميع الفروع مراجعة وتحديث ملفات الملاك الوظيفي وإرسالها إلكترونياً عبر منصة مسار',
      '   في موعد أقصاه نهاية الأسبوع القادم.',
      '٢. اعتماد قرارات النقل والتكليف الداخلي الصادرة من اللجنة العليا للموارد البشرية.',
      '٣. تجميد مؤقت للترشيحات غير المستكملة ريثما تنتهي المطابقة السنوية.',
      '',
      'نؤكد على سرعة الالتزام وتطبيق التوجيهات لتفادي تأخير ميزانيات الرواتب السنوية.',
      '',
      'وتقبلوا وافر التحية والتقدير،'
    ];

    let startY = 240;
    lines.forEach((line) => {
      ctx.fillText(line, canvas.width - 45, startY);
      startY += 25;
    });

    // Signature Block
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('م. عبد الرحمن عبد الله السديري', 45, 630);
    ctx.fillText('وكيل الوزارة للتمكين والمساندة', 45, 652);

    // Draw Purple Ink Signature
    ctx.strokeStyle = '#581c87';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(70, 580);
    ctx.quadraticCurveTo(110, 540, 130, 590);
    ctx.quadraticCurveTo(150, 610, 80, 600);
    ctx.bezierCurveTo(40, 590, 160, 570, 120, 610);
    ctx.stroke();

    // Green Stamp
    ctx.strokeStyle = 'rgba(21, 128, 61, 0.6)';
    ctx.fillStyle = 'rgba(21, 128, 61, 0.02)';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvas.width - 180, 630, 130, 65);
    ctx.fillRect(canvas.width - 180, 630, 130, 65);
    
    ctx.fillStyle = 'rgba(21, 128, 61, 0.7)';
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.fillText('وزارة الموارد البشرية', canvas.width - 115, 646);
    ctx.fillText('مكتب وكيل الوزارة - صادر', canvas.width - 115, 662);
    ctx.fillText('٢٠ صفر ١٤٤٧ هـ', canvas.width - 115, 678);

  } else {
    // ---- Type 3: Board Resolution (Private Company) ----
    // Top right header
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('الشركة الوطنية للاتصالات وتقنية المعلومات', canvas.width - 45, 50);
    ctx.fillText('ش.م.ع - سجل تجاري رقم ١٠٠٢٩٣', canvas.width - 45, 72);
    ctx.fillText('أمانة سر مجلس الإدارة', canvas.width - 45, 94);

    // Top left header
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('القرار: ص - ٢٠٢٦ - ٥٥', 45, 50);
    ctx.fillText('التاريخ: ٠٩ مارس ٢٠٢٦ م', 45, 72);
    ctx.fillText('المستوى: سري وهام للغاية', 45, 94);

    // Corporate Logo Icon
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f766e'; // Teal
    ctx.fillRect(canvas.width / 2 - 20, 50, 40, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('N', canvas.width / 2, 59);

    // Divider
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 130);
    ctx.lineTo(canvas.width - 40, 130);
    ctx.stroke();

    // Document Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText('قرار مجلس الإدارة رقم (٥٥ / ٢٠٢٦)', canvas.width / 2, 160);

    // Document Subject
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('شأن: تمديد عقود التوريد الخارجي وتفويض صلاحيات الشراء التنفيذي', canvas.width / 2, 190);

    // Body
    ctx.textAlign = 'right';
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#334155';

    const lines = [
      'إن مجلس الإدارة في جلسته السنوية الرابعة، وبناءً على التقرير الفني المرفوع من الرئيس التنفيذي،',
      'وبعد استعراض العروض المالية لشركاء التوريد، قرر بالإجماع ما يلي:',
      '',
      'أولاً: تمديد اتفاقية التوريد والخدمات اللوجستية الإقليمية المبرمة مع شركة "سيسكو العالمية"',
      '      لمدة سنتين إضافيتين تبدأ من تاريخ انتهاء العقد الحالي بقيمة تقديرية لا تتجاوز ٥ ملايين دولار.',
      '',
      'ثانياً: تفويض الإدارة التنفيذية ممثلة بالرئيس التنفيذي المالي للتوقيع على الملاحق الفنية والتعاقدية',
      '       وصرف الدفعات التشغيلية وفق الميزانية المعتمدة للربع الثاني لعام ٢٠٢٦.',
      '',
      'ثالثاً: تشكيل لجنة رقابة داخلية برئاسة رئيس لجنة التدقيق والمراجعة لمتابعة معايير الجودة والتنفيذ',
      '       وتقديم تقرير نصف سنوي للمجلس.',
      '',
      'رابعاً: يُبلغ هذا القرار للإدارة المالية والمشتريات والامتثال للعمل بموجبه فوراً.'
    ];

    let startY = 240;
    lines.forEach((line) => {
      ctx.fillText(line, canvas.width - 45, startY);
      startY += 26;
    });

    // Signature Block
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillText('خالد سليمان الغانم', 45, 620);
    ctx.fillText('رئيس مجلس الإدارة', 45, 642);

    // Draw Blue/Black ink signature
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(60, 560);
    ctx.bezierCurveTo(90, 540, 160, 580, 110, 590);
    ctx.bezierCurveTo(80, 600, 70, 560, 140, 570);
    ctx.stroke();

    // Red Corporate Seal
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.65)';
    ctx.fillStyle = 'rgba(220, 38, 38, 0.02)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(canvas.width - 150, 630, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Inner star pattern or decorative text
    ctx.fillStyle = 'rgba(220, 38, 38, 0.7)';
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.fillText('الشركة الوطنية للاتصالات', canvas.width - 150, 615);
    ctx.fillText('★ أمانة مجلس الإدارة ★', canvas.width - 150, 630);
    ctx.fillText('الختم المعتمد', canvas.width - 150, 645);
  }

  // Convert to Base64 (MIME Type: image/png)
  const mimeType = 'image/png';
  const dataUrl = canvas.toDataURL(mimeType);
  const base64 = dataUrl.split(',')[1];
  
  // Create a realistic file name and simulated file size
  const docTypeNames = {
    admin: 'أمر_إداري_جامعة_بغداد',
    saudi: 'كتاب_وزارة_الموارد_البشرية',
    board: 'قرار_مجلس_الشركة_الوطنية'
  };
  const fileName = `${docTypeNames[type]}_نموذج.png`;
  // Approx size based on data string length
  const approxSizeKb = Math.round((base64.length * 3) / 4 / 1024);
  const fileSize = `${approxSizeKb} كيلوبايت`;

  return {
    base64,
    mimeType,
    fileName,
    fileSize
  };
}
