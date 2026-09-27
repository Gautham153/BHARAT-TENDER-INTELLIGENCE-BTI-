// Bharat Tender Intelligence (BTI) — Gemini Document Extraction Provider
// Phase 11: Server-Side Document Understanding using @google/genai SDK
// Mandate: AI extraction is strictly decision-support advisory.
// Never declares fraud or corruption; extracts only structured fields with confidence and source.

import { GoogleGenAI } from '@google/genai';
import { DocumentType, DocumentExtractedData } from '../../src/types/document.js';

export interface DocumentExtractionProvider {
  extractDocument(params: {
    documentId: string;
    fileName: string;
    mimeType: string;
    declaredType: DocumentType;
    base64Data?: string;
    textSample?: string;
    projectContext?: {
      projectId: string;
      projectTitle?: string;
      sanctionedAmount?: number;
      awardedAmount?: number;
      implementingAgencyName?: string;
    };
  }): Promise<{
    detectedDocumentType?: DocumentType;
    extractedData: DocumentExtractedData;
    warnings?: string[];
    provider: string;
    model: string;
  }>;
}

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const EXTRACTION_SYSTEM_INSTRUCTION = `You are the Document Intelligence Engine for Bharat Tender Intelligence (BTI), extracting structured fields from public procurement and project execution documents under India's MPLAD scheme.

CRITICAL OPERATIONAL RULES:
1. ADVISORY EXTRACTION ONLY: You are an objective text and document extractor. You DO NOT make legal, ethical, or administrative judgments.
2. ABSOLUTELY NO FRAUD ACCUSATIONS: You are STRICTLY FORBIDDEN from declaring "Fraud Detected", "Fraudulent Document", "Illegal", "Corruption", or "Fake".
3. TRUTHFULNESS & GROUNDING: Extract ONLY what is actually present in the provided document text or content. If a field is not present or cannot be determined with certainty, omit it or set value to null. DO NOT invent or hallucinate amounts, dates, or reference numbers.
4. CONFIDENCE & PROVENANCE: For each extracted field, provide a numeric confidence between 0.1 and 1.0, and a concise "source" indicating where in the document it was found (e.g., "Invoice Header", "Sanction Order Body", "Signature Box").
5. DOCUMENT TYPES: Standard types are INVOICE, SANCTION_DOCUMENT, COMPLETION_CERTIFICATE, UTILIZATION_CERTIFICATE, INSPECTION_REPORT, PROPOSAL_DOCUMENT, OTHER_SUPPORTING_DOCUMENT.

Output must be valid JSON matching the specified structure without markdown wrapping.`;

export class GeminiDocumentExtractionProvider implements DocumentExtractionProvider {
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim().length > 0) {
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  async extractDocument(params: {
    documentId: string;
    fileName: string;
    mimeType: string;
    declaredType: DocumentType;
    base64Data?: string;
    textSample?: string;
    projectContext?: {
      projectId: string;
      projectTitle?: string;
      sanctionedAmount?: number;
      awardedAmount?: number;
      implementingAgencyName?: string;
    };
  }): Promise<{
    detectedDocumentType?: DocumentType;
    extractedData: DocumentExtractedData;
    warnings?: string[];
    provider: string;
    model: string;
  }> {
    const { fileName, mimeType, declaredType, base64Data, textSample, projectContext } = params;

    if (!this.aiClient) {
      throw new Error('Gemini API key is not configured on the server. Original document preserved for manual review.');
    }

    const parts: any[] = [];

    // If binary data is provided and is an image or PDF, pass as inlineData
    if (base64Data && (mimeType.startsWith('image/') || mimeType === 'application/pdf')) {
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }

    const promptText = `Analyze this document titled "${fileName}" (Declared Type: ${declaredType}).
Associated Project Context: ${JSON.stringify(projectContext || {})}
${textSample ? `Extracted Text Sample:\n"""${textSample.slice(0, 4000)}"""\n` : ''}

Extract all structured metadata following this JSON schema:
{
  "detectedDocumentType": "${declaredType}",
  "extractedData": {
    "documentType": { "value": "INVOICE", "confidence": 0.95, "source": "Header" },
    "documentReferenceNumber": { "value": "REF-123", "confidence": 0.9, "source": "..." },
    "invoiceNumber": { "value": null, "confidence": 0.0 },
    "sanctionNumber": { "value": null, "confidence": 0.0 },
    "certificateNumber": { "value": null, "confidence": 0.0 },
    "projectId": { "value": null, "confidence": 0.0 },
    "projectReferenceNumber": { "value": null, "confidence": 0.0 },
    "organizationName": { "value": null, "confidence": 0.0 },
    "agencyName": { "value": null, "confidence": 0.0 },
    "gstin": { "value": null, "confidence": 0.0 },
    "amount": { "value": null, "confidence": 0.0 },
    "currency": { "value": "INR", "confidence": 0.9 },
    "expenditureAmount": { "value": null, "confidence": 0.0 },
    "sanctionedAmount": { "value": null, "confidence": 0.0 },
    "utilizationAmount": { "value": null, "confidence": 0.0 },
    "documentDate": { "value": null, "confidence": 0.0 },
    "completionDate": { "value": null, "confidence": 0.0 },
    "inspectionDate": { "value": null, "confidence": 0.0 },
    "completionPercentage": { "value": null, "confidence": 0.0 },
    "location": { "value": null, "confidence": 0.0 },
    "issuingAuthority": { "value": null, "confidence": 0.0 },
    "observations": { "value": null, "confidence": 0.0 }
  },
  "warnings": []
}`;

    parts.push({ text: promptText });

    const response = await this.aiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts },
      config: {
        systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.1, // High precision
      },
    });

    const responseText = response.text || '';
    if (!responseText.trim()) {
      throw new Error('Gemini returned an empty extraction payload.');
    }

    try {
      const parsed = JSON.parse(responseText);
      const extractedData: DocumentExtractedData = parsed.extractedData || {};

      return {
        detectedDocumentType: parsed.detectedDocumentType || declaredType,
        extractedData,
        warnings: parsed.warnings || [],
        provider: 'Gemini Document Intelligence',
        model: GEMINI_MODEL,
      };
    } catch (parseErr) {
      console.error('[GeminiDocumentExtractionProvider] JSON parse error:', parseErr, responseText);
      throw new Error('Failed to parse structured document metadata from AI extraction.');
    }
  }
}
