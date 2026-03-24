/**
 * GeminiProvider - Main API Orchestrator
 *
 * Handles all communication with Gemini API including:
 * - Request construction with system prompts
 * - Content analysis and thinking level detection
 * - Grounding integration
 * - Response parsing
 * - Error handling with retry logic
 */

import { requestUrl, RequestUrlResponse } from 'obsidian';
import { SanitizerEngine } from './SanitizerEngine';
import { CostTracker } from './CostTracker';
import {
    GeminiResearchBrainSettings,
    GeminiRequest,
    GeminiResponse,
    GeminiContent,
    ResearchInsightResult,
    ResearchInsightOptions,
    InvertedPyramidSummary,
    ContentAnalysis,
    ThinkingLevel,
    CodeLanguage,
    GroundingResult,
    TokenUsage,
} from '../types';

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class GeminiProvider {
    private settings: GeminiResearchBrainSettings;
    private sanitizer: SanitizerEngine;
    private costTracker: CostTracker;
    private systemPrompt: string;
    private medicalPrompt: string;
    private codeAuditPrompt: string;

    constructor(
        settings: GeminiResearchBrainSettings,
        sanitizer: SanitizerEngine,
        costTracker: CostTracker
    ) {
        this.settings = settings;
        this.sanitizer = sanitizer;
        this.costTracker = costTracker;
        this.systemPrompt = '';
        this.medicalPrompt = '';
        this.codeAuditPrompt = '';
    }

    /**
     * Load system prompts from XML files
     */
    public async loadSystemPrompts(
        systemPrompt: string,
        medicalPrompt: string,
        codeAuditPrompt: string
    ): Promise<void> {
        this.systemPrompt = systemPrompt;
        this.medicalPrompt = medicalPrompt;
        this.codeAuditPrompt = codeAuditPrompt;
    }

    /**
     * Update settings reference
     */
    public updateSettings(settings: GeminiResearchBrainSettings): void {
        this.settings = settings;
    }

    /**
     * Analyze content to determine complexity and features
     */
    public analyzeContent(text: string): ContentAnalysis {
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

        // Detect code blocks
        const codeBlockMatches = text.match(/```(\w+)?[\s\S]*?```/g) || [];
        const hasCodeBlocks = codeBlockMatches.length > 0;

        // Detect code languages
        const codeLanguages: CodeLanguage[] = [];
        const languagePatterns: { pattern: RegExp; lang: CodeLanguage }[] = [
            { pattern: /```(?:nextflow|nf)/i, lang: 'nextflow' },
            { pattern: /```(?:python|py)/i, lang: 'python' },
            { pattern: /```(?:bash|sh|shell)/i, lang: 'bash' },
            { pattern: /```(?:r|rscript)/i, lang: 'r' },
            { pattern: /```wdl/i, lang: 'wdl' },
        ];
        for (const { pattern, lang } of languagePatterns) {
            if (pattern.test(text)) {
                codeLanguages.push(lang);
            }
        }
        if (hasCodeBlocks && codeLanguages.length === 0) {
            codeLanguages.push('unknown');
        }

        // Detect clinical claims (p-values, statistics, clinical terms)
        const clinicalPatterns = [
            /\bp[\s]*[<>=]\s*[\d.e-]+/gi,           // p-values
            /\bAUC[\s]*[=:]\s*[\d.]+/gi,            // AUC values
            /\b(?:sensitivity|specificity)[\s]*[=:]\s*[\d.%]+/gi,
            /\b(?:hazard ratio|HR|odds ratio|OR)[\s]*[=:]\s*[\d.]+/gi,
            /\bCI[\s]*[=:]?\s*\[?\d+\.?\d*%?\s*[-–]\s*\d+\.?\d*%?\]?/gi,  // Confidence intervals
            /\b(?:RCT|randomized|double-blind|placebo)/gi,
            /\b(?:cohort|case-control|meta-analysis)/gi,
        ];
        const hasClinicalClaims = clinicalPatterns.some(p => p.test(text));

        // Detect biomedical terms
        const biomedicalPatterns = [
            /\b[A-Z][A-Z0-9]{1,5}\d?\b/g,  // Gene symbols (BRCA1, TP53, etc.)
            /\bc\.\d+[A-Z>]+/gi,            // HGVS cDNA notation
            /\bp\.[A-Z][a-z]{2}\d+[A-Z][a-z]{2}/gi,  // HGVS protein notation
            /\brs\d{5,12}\b/gi,             // dbSNP IDs
            /\bNM_\d+/gi,                   // RefSeq transcripts
            /\b(?:exon|intron)\s*\d+/gi,
            /\b(?:germline|somatic|variant|mutation|allele)/gi,
        ];
        const hasBiomedicalTerms = biomedicalPatterns.some(p => p.test(text));

        // Detect statistical content
        const statisticsPatterns = [
            /\bn\s*=\s*\d+/gi,
            /\b(?:mean|median|SD|SEM|IQR)[\s]*[=:]/gi,
            /\b\d+(?:\.\d+)?%/g,
            /\bFold[ -]?change[\s]*[=:]\s*[\d.]+/gi,
        ];
        const statsMatches = statisticsPatterns.reduce(
            (count, p) => count + (text.match(p)?.length || 0), 0
        );
        const hasStatistics = statsMatches >= 2;

        // Count gene symbols (rough heuristic)
        const genePattern = /\b[A-Z][A-Z0-9]{1,5}\d?\b/g;
        const potentialGenes = text.match(genePattern) || [];
        // Filter out common non-gene acronyms
        const excludeWords = new Set([
            'AND', 'OR', 'NOT', 'THE', 'FOR', 'WITH', 'FROM', 'INTO',
            'API', 'URL', 'SQL', 'CSS', 'HTML', 'JSON', 'XML', 'AWS',
            'DNA', 'RNA', 'MRN', 'DOB', 'SSN', 'PDF', 'CSV', 'TSV',
        ]);
        const genes = potentialGenes.filter(g => !excludeWords.has(g));
        const geneCount = genes.length;

        // PHI check
        const phiResult = this.sanitizer.scan(text);
        const containsPHI = phiResult.containsPHI;

        // Calculate complexity score
        let complexityScore = 0;
        if (hasClinicalClaims) complexityScore += 2;
        if (hasBiomedicalTerms) complexityScore += 1;
        if (hasCodeBlocks) complexityScore += 2;
        if (hasStatistics) complexityScore += 1;
        if (wordCount > 500) complexityScore += 1;
        if (geneCount > 3) complexityScore += 1;

        // Suggest thinking level
        const suggestedThinkingLevel: ThinkingLevel = complexityScore >= 3 ? 'high' : 'low';

        return {
            wordCount,
            hasCodeBlocks,
            codeLanguages,
            hasClinicalClaims,
            hasBiomedicalTerms,
            hasStatistics,
            geneCount,
            genes: [...new Set(genes)].slice(0, 10),
            containsPHI,
            complexityScore,
            suggestedThinkingLevel,
        };
    }

    /**
     * Build the system instruction based on content and options
     */
    private buildSystemInstruction(
        analysis: ContentAnalysis,
        options: ResearchInsightOptions
    ): string {
        let instruction = this.systemPrompt;

        // Enforce markdown output and prevent XML responses
        instruction += '\n\nIMPORTANT: The system instruction is provided in XML for structure. Do NOT output XML. Respond only in Markdown text.';

        // Add medical research mode if clinical content detected
        if (analysis.hasClinicalClaims || analysis.hasBiomedicalTerms) {
            instruction += '\n\n' + this.medicalPrompt;
        }

        // Add code auditor mode if code blocks present
        if (analysis.hasCodeBlocks && options.enableCodeAudit) {
            instruction += '\n\n' + this.codeAuditPrompt;
        }

        return instruction;
    }

    /**
     * Make API call to Gemini with retry logic
     */
    private async callGeminiAPI(
        request: GeminiRequest,
        useGrounding: boolean = false
    ): Promise<GeminiResponse> {
        if (!this.settings.apiKey) {
            throw new Error('⚠️ Gemini API key not configured. Go to Settings → Gemini Research Brain → API Configuration');
        }

        if (this.costTracker.isBudgetExhausted()) {
            throw new Error('🚫 Monthly budget exhausted. Processing disabled until next month.');
        }

        let model = this.settings.model;
        let endpoint = `${API_BASE_URL}/${model}:generateContent?key=${this.settings.apiKey}`;

        // Add grounding tool if enabled
        if (useGrounding && this.settings.enableGrounding) {
            request.tools = [{ googleSearch: {} }];
        }

        let lastError: Error | null = null;
        let requestToSend: GeminiRequest = JSON.parse(JSON.stringify(request));
        let strippedTools = false;
        let strippedThinking = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response: RequestUrlResponse = await requestUrl({
                    url: endpoint,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestToSend),
                });

                if (response.status !== 200) {
                    const errorBody = response.json;
                    const errorMessage = errorBody?.error?.message || response.text || 'Unknown error';
                    throw new Error(
                        `Gemini API error (${response.status}): ${errorMessage}`
                    );
                }

                return response.json as GeminiResponse;
            } catch (error) {
                const err = error as any;
                if (err?.status && err?.response) {
                    const errorBody = err.response?.json;
                    const errorMessage = errorBody?.error?.message || err.response?.text || err.message;
                    lastError = new Error(`Gemini API error (${err.status}): ${errorMessage}`);
                } else {
                    lastError = error as Error;
                }

                if (this.settings.debugMode) {
                    console.error(`Gemini API attempt ${attempt} failed:`, lastError);
                }

                // Handle model not found (404)
                if (lastError.message.includes('404')) {
                    if (model.startsWith('gemini-3.0')) {
                        model = 'gemini-2.0-flash';
                        endpoint = `${API_BASE_URL}/${model}:generateContent?key=${this.settings.apiKey}`;
                        continue;
                    }
                    throw new Error('⚠️ Gemini API returned 404. This usually means the Generative Language API is not enabled for your project or the API key belongs to a different project. Verify the API is enabled and the key is from the same project, then try again.');
                }

                // Handle bad request (400) by stripping unsupported fields
                if (lastError.message.includes('400')) {
                    if (!strippedTools && requestToSend.tools) {
                        strippedTools = true;
                        const cloned = JSON.parse(JSON.stringify(requestToSend)) as GeminiRequest;
                        delete cloned.tools;
                        requestToSend = cloned;
                        continue;
                    }
                    if (!strippedThinking && requestToSend.generationConfig?.thinkingConfig) {
                        strippedThinking = true;
                        const cloned = JSON.parse(JSON.stringify(requestToSend)) as GeminiRequest;
                        if (cloned.generationConfig) {
                            delete cloned.generationConfig.thinkingConfig;
                        }
                        requestToSend = cloned;
                        continue;
                    }
                }

                // Don't retry on authentication errors
                if (lastError.message.includes('401') || lastError.message.includes('403')) {
                    throw new Error('⚠️ Invalid API key. Please check your Gemini API key in settings.');
                }

                // Don't retry on rate limit (wait longer)
                if (lastError.message.includes('429')) {
                    if (attempt < MAX_RETRIES) {
                        await this.delay(RETRY_DELAY_MS * attempt * 2);
                        continue;
                    }
                    throw new Error('⏳ Rate limit exceeded. Please try again in a few minutes.');
                }

                // Exponential backoff for other errors
                if (attempt < MAX_RETRIES) {
                    await this.delay(RETRY_DELAY_MS * attempt);
                }
            }
        }

        throw lastError || new Error('Failed to call Gemini API after multiple attempts');
    }

    /**
     * Delay helper for retry logic
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate research insight for a journal entry
     */
    public async generateResearchInsight(
        entry: string,
        options: ResearchInsightOptions = {}
    ): Promise<ResearchInsightResult> {
        const startTime = Date.now();

        // Step 1: Analyze content
        const analysis = this.analyzeContent(entry);

        // Step 2: PHI Check - MUST block if PHI detected (unless user overrides)
        if (analysis.containsPHI && !options.skipPhiCheck) {
            const scanResult = this.sanitizer.scan(entry);
            const report = this.sanitizer.generateReport(scanResult);
            throw new Error(`🚫 PHI/PII Detected - Cannot Process\n\n${report}`);
        }

        // Step 3: Determine thinking level
        const thinkingLevel = this.settings.autoDetectThinkingLevel
            ? analysis.suggestedThinkingLevel
            : (options.thinkingLevel || this.settings.thinkingLevel);

        // Step 4: Build system instruction
        const systemInstruction = this.buildSystemInstruction(analysis, options);

        // Step 5: Build request
        const request: GeminiRequest = {
            contents: [{
                role: 'user',
                parts: [{ text: this.buildUserPrompt(entry, analysis, options) }]
            }],
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                temperature: this.settings.temperature,
                maxOutputTokens: this.settings.maxOutputTokens,
            }
        };

        // Add thinking config for high complexity
        if (thinkingLevel === 'high') {
            request.generationConfig!.thinkingConfig = {
                thinkingBudget: 8192
            };
        }

        // Step 6: Call API
        const useGrounding = options.enableGrounding ?? this.settings.enableGrounding;
        const response = await this.callGeminiAPI(request, useGrounding && analysis.hasClinicalClaims);

        // Step 7: Parse response
        const result = this.parseResponse(response, analysis, options);

        // Step 8: Record usage
        if (response.usageMetadata) {
            const usage = this.costTracker.recordUsage(
                this.settings.model,
                response.usageMetadata.promptTokenCount,
                response.usageMetadata.candidatesTokenCount,
                response.usageMetadata.thoughtsTokenCount || 0
            );
            result.usage = usage;
        }

        result.processingTime = Date.now() - startTime;

        return result;
    }

    /**
     * Build the user prompt with specific instructions
     */
    private buildUserPrompt(
        entry: string,
        analysis: ContentAnalysis,
        options: ResearchInsightOptions
    ): string {
        const parts: string[] = [];

        parts.push('Analyze the following research journal entry and provide insights:\n');
        parts.push('---');
        parts.push(entry);
        parts.push('---\n');

        parts.push('Please provide:\n');
        parts.push('1. **Inverted Pyramid Summary** (required). Use this exact template:');
        parts.push('   Lead: <single sentence>');
        parts.push('   Body: <single sentence>');
        parts.push('   Tail: <single sentence>\n');

        if (analysis.hasClinicalClaims && (options.enableGrounding ?? this.settings.enableGrounding)) {
            parts.push('2. **Grounding Verification**: Verify any clinical claims against current literature.\n');
        }

        if (analysis.hasCodeBlocks && (options.enableCodeAudit ?? this.settings.enableCodeAudit)) {
            parts.push('3. **Code Audit**: Review any code blocks for issues, with focus on bioinformatics best practices.\n');
        }

        if (options.enableFrameAnalysis ?? this.settings.enableFrameAnalysis) {
            parts.push('4. **Frame Analysis**: Identify cognitive frames and potential biases.\n');
        }

        if (options.enableVaultConnector ?? this.settings.enableVaultConnector) {
            parts.push('5. **Vault Connections**: Suggest potential note links based on content.\n');
        }

        if (options.enableFiveWhys ?? this.settings.enableFiveWhys) {
            if (entry.toLowerCase().includes('problem') || entry.toLowerCase().includes('issue') || entry.toLowerCase().includes('blocker')) {
                parts.push('6. **5-Whys Analysis**: Apply root cause analysis to any problems mentioned.\n');
            }
        }

        parts.push('\nFormat your response with clear section headers using markdown.');
        parts.push('Do NOT output XML.');

        return parts.join('\n');
    }

    /**
     * Parse Gemini response into structured result
     */
    private parseResponse(
        response: GeminiResponse,
        analysis: ContentAnalysis,
        options: ResearchInsightOptions
    ): ResearchInsightResult {
        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) {
            throw new Error('Invalid response from Gemini API: no content');
        }

        // Extract text content (excluding thinking parts)
        const textParts = candidate.content.parts.filter(p => !p.thought && p.text);
        const fullText = textParts.map(p => p.text).join('\n');

        // Parse inverted pyramid summary
        const summary = this.parseInvertedPyramid(fullText);

        // Parse grounding if available
        let grounding: GroundingResult | undefined;
        if (candidate.groundingMetadata) {
            grounding = this.parseGrounding(candidate.groundingMetadata);
        }

        // Create result
        const result: ResearchInsightResult = {
            success: true,
            summary,
            grounding,
            usage: {
                inputTokens: response.usageMetadata?.promptTokenCount || 0,
                outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
                thinkingTokens: response.usageMetadata?.thoughtsTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0,
                estimatedCost: 0,
            },
            processingTime: 0,
        };

        return result;
    }

    /**
     * Parse inverted pyramid summary from response text
     */
    private parseInvertedPyramid(text: string): InvertedPyramidSummary {
        // Try to find structured summary
        const leadMatch = text.match(/(?:Lead|Main Insight)\s*[:\-]\s*(.+?)(?=\n|Body|$)/is);
        const bodyMatch = text.match(/(?:Body|Context)\s*[:\-]\s*(.+?)(?=\n|Tail|$)/is);
        const tailMatch = text.match(/(?:Tail|Implications|Next Steps)\s*[:\-]\s*(.+?)(?=\n|$)/is);

        // Fallback: use first three sentences if no structure found
        if (!leadMatch && !bodyMatch && !tailMatch) {
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
            return {
                lead: sentences[0]?.trim() || 'No summary available.',
                body: sentences[1]?.trim() || '',
                tail: sentences[2]?.trim() || '',
                fullSummary: sentences.slice(0, 3).join(' ').trim(),
            };
        }

        const lead = leadMatch?.[1]?.trim() || '';
        const body = bodyMatch?.[1]?.trim() || '';
        const tail = tailMatch?.[1]?.trim() || '';

        return {
            lead,
            body,
            tail,
            fullSummary: [lead, body, tail].filter(Boolean).join(' '),
        };
    }

    /**
     * Parse grounding metadata into structured result
     */
    private parseGrounding(metadata: {
        groundingChunks?: Array<{ web?: { uri: string; title: string } }>;
        groundingSupports?: Array<{
            segment?: { text: string };
            confidenceScores?: number[];
        }>;
        webSearchQueries?: string[];
    }): GroundingResult {
        const sources = (metadata.groundingChunks || [])
            .filter(chunk => chunk.web)
            .map(chunk => ({
                url: chunk.web!.uri,
                title: chunk.web!.title,
                relevance: 1.0,
            }));

        const verifiedClaims = (metadata.groundingSupports || [])
            .filter(support => support.segment?.text)
            .map(support => ({
                claim: support.segment!.text,
                status: 'verified' as const,
                sources: [],
                confidence: support.confidenceScores?.[0] || 0.5,
            }));

        return {
            enabled: true,
            sources,
            verifiedClaims,
            searchQueries: metadata.webSearchQueries || [],
        };
    }

    /**
     * Format result as markdown for insertion
     */
    public formatResultAsMarkdown(result: ResearchInsightResult): string {
        const lines: string[] = [];

        lines.push('## 🧠 Research Insight');
        lines.push('');

        // Inverted Pyramid Summary
        lines.push('### 📝 Summary');
        lines.push('');
        lines.push(`**Lead:** ${result.summary.lead}`);
        lines.push('');
        lines.push(`**Context:** ${result.summary.body}`);
        lines.push('');
        lines.push(`**Implications:** ${result.summary.tail}`);
        lines.push('');

        // Grounding Results
        if (result.grounding && result.grounding.sources.length > 0) {
            lines.push('### 🔍 Source Verification');
            lines.push('');
            for (const source of result.grounding.sources.slice(0, 5)) {
                lines.push(`- [${source.title}](${source.url})`);
            }
            lines.push('');
        }

        // Code Audit Results
        if (result.codeAudit) {
            lines.push('### 💻 Code Audit');
            lines.push('');
            if (result.codeAudit.criticalIssues.length > 0) {
                lines.push('**Critical Issues:**');
                for (const issue of result.codeAudit.criticalIssues) {
                    lines.push(`- 🚨 ${issue.description}`);
                    lines.push(`  - Suggestion: ${issue.suggestion}`);
                }
                lines.push('');
            }
            if (result.codeAudit.warnings.length > 0) {
                lines.push('**Warnings:**');
                for (const warning of result.codeAudit.warnings) {
                    lines.push(`- ⚠️ ${warning.description}`);
                }
                lines.push('');
            }
        }

        // Vault Connections
        if (result.vaultConnections && result.vaultConnections.length > 0) {
            lines.push('### 🔗 Suggested Connections');
            lines.push('');
            for (const connection of result.vaultConnections) {
                lines.push(`- [[${connection.suggestedNote}]] — ${connection.reason}`);
            }
            lines.push('');
        }

        // Usage stats
        lines.push('---');
        lines.push(`*Generated by Gemini Research Brain | Cost: $${result.usage.estimatedCost.toFixed(4)} | Time: ${(result.processingTime / 1000).toFixed(1)}s*`);

        return lines.join('\n');
    }

    /**
     * Test API connection
     */
    public async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const request: GeminiRequest = {
                contents: [{
                    role: 'user',
                    parts: [{ text: 'Say "Connection successful" in exactly those words.' }]
                }],
                generationConfig: {
                    maxOutputTokens: 50,
                }
            };

            const response = await this.callGeminiAPI(request, false);

            if (this.extractCandidateText(response)) {
                return { success: true, message: '✅ API connection successful!' };
            }

            return { success: false, message: '⚠️ Unexpected API response format' };
        } catch (error) {
            return { success: false, message: `❌ ${(error as Error).message}` };
        }
    }

    private extractCandidateText(response: GeminiResponse): string | null {
        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) {
            return null;
        }

        const textParts = candidate.content.parts
            .filter(part => part.text)
            .map(part => part.text?.trim())
            .filter((text): text is string => Boolean(text));

        if (textParts.length === 0) {
            return null;
        }

        return textParts.join('\n');
    }
}
