/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  statisticalNumber: string;
  classification: string;
  rank: string;
  grade: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  motherName: string;
  province: string;
  workspace: string;
  role: 'admin' | 'data_entry';
  createdAt: number;
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete';
  documentId: string;
  documentNumber: string;
  documentSubject: string;
  userId: string;
  userName: string;
  timestamp: number;
  details?: string;
}

export interface DocumentRecord {
  id: string;
  fileName: string;
  fileSize: string;
  imageUrl: string; // Blob URL or base64 data URL
  base64Data: string; // Stripped base64 string for API
  mimeType: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  error?: string;
  ocrProgress?: string;
  
  // Audit fields
  createdBy?: string;
  createdByName?: string;
  lastModifiedBy?: string;
  lastModifiedByName?: string;
  
  // Extracted fields (editable by user)
  documentNumber: string;
  documentDate: string;
  issuingAuthority: string;
  documentSubject: string;
  destinationAuthority?: string;
  documentContent?: string;
  confidenceScore: number;
  extractedText: string;
  documentType?: string; // e.g. تقاعد, عقوبة, نقل وإلحاق, التحاق, سحب يد, إجازة سنوية, وفاة, تاريخ انفكاك
  references?: Array<{
    referenceNumber: string;
    referenceDate: string;
    referenceAuthority: string;
  }>;
  penaltyType?: string; // نوع العقوبة
  legalArticle?: string; // المادة القانونية
  penaltyReason?: string; // سبب العقوبة
  penaltyDuration?: string; // مدة العقوبة
  hrLetterNumber?: string; // رقم كتاب مديرية الموارد البشرية
  hrLetterDate?: string; // تاريخ كتاب مديرية الموارد البشرية
  securityLetterNumber?: string; // رقم كتاب وكالة الأمن الاتحادي
  securityLetterDate?: string; // تاريخ كتاب وكالة الأمن الاتحادي
  createdAt?: number; // وقت إنشاء المستند للتصنيف والترتيب
  employeeNames?: string; // الأسماء المذكورة في الكتاب (مفصولة بأسطر أو فواصل)
  notes?: Array<{
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
    createdAt?: string;
  }>;
  highlights?: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
  }>;
}

export interface ExtractionStats {
  total: number;
  processing: number;
  success: number;
  error: number;
  avgConfidence: number;
}
