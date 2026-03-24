/**
 * Gemini Research Brain - TypeScript Type Definitions
 *
 * All interfaces and types used throughout the plugin.
 */

// ============================================================================
// Plugin Settings
// ============================================================================

export interface GeminiResearchBrainSettings {
    // API Configuration
    apiKey: string;
    model: GeminiModel;
    thinkingLevel: ThinkingLevel;
    autoDetectThinkingLevel: boolean;
    temperature: number;
    maxOutputTokens: number;

    // Budget Configuration
    monthlyBudget: number;
    budgetAlertThreshold: number;

    // Feature Toggles
    enableGrounding: boolean;
    enablePubMed: boolean;
    enableCodeAudit: boolean;
    enableFrameAnalysis: boolean;
    enableVaultConnector: boolean;
    enableFiveWhys: boolean;
    enableShadowPrompt: boolean;

    // UI Options
    showPreviewModal: boolean;
    autoInsertOnMobile: boolean;
    debugMode: boolean;

    // Backup Options
    enableAutoBackup: boolean;
    backupLocation: string;
}

export const DEFAULT_SETTINGS: GeminiResearchBrainSettings = {
    apiKey: '',
    model: 'gemini-3-pro-preview',
    thinkingLevel: 'low',
    autoDetectThinkingLevel: true,
    temperature: 1.0,
    maxOutputTokens: 8192,

    monthlyBudget: 100,
    budgetAlertThreshold: 80,

    enableGrounding: true,
    enablePubMed: true,
    enableCodeAudit: true,
    enableFrameAnalysis: false,
    enableVaultConnector: false,
    enableFiveWhys: false,
    enableShadowPrompt: false,

    showPreviewModal: true,
    autoInsertOnMobile: false,
    debugMode: false,

    enableAutoBackup: true,
    backupLocation: '.gemini-research-brain-backups',
};

// ============================================================================
// Gemini API Types
// ============================================================================

export type GeminiModel =
    | 'gemini-3-pro-preview'
    | 'gemini-3-flash-preview'
    | 'gemini-flash-latest'
    | 'gemini-flash-lite-latest';

export type ThinkingLevel = 'low' | 'high';

export interface GeminiRequest {
    contents: GeminiContent[];
    systemInstruction?: GeminiContent;
    generationConfig?: GeminiGenerationConfig;
    tools?: GeminiTool[];
}

export interface GeminiContent {
    role?: 'user' | 'model';
    parts: GeminiPart[];
}

export interface GeminiPart {
    text?: string;
    thought?: boolean;
}

export interface GeminiGenerationConfig {
    temperature?: number;
    maxOutputTokens?: number;
    thinkingConfig?: {
        thinkingBudget: number;
    };
}

export interface GeminiTool {
    googleSearch?: Record<string, never>;
}

export interface GeminiResponse {
    candidates: GeminiCandidate[];
    usageMetadata?: GeminiUsageMetadata;
    modelVersion?: string;
}

export interface GeminiCandidate {
    content: GeminiContent;
    groundingMetadata?: GroundingMetadata;
    finishReason?: string;
}

export interface GeminiUsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
    thoughtsTokenCount?: number;
}

export interface GroundingMetadata {
    groundingChunks?: GroundingChunk[];
    groundingSupports?: GroundingSupport[];
    webSearchQueries?: string[];
}

export interface GroundingChunk {
    web?: {
        uri: string;
        title: string;
    };
}

export interface GroundingSupport {
    segment?: {
        startIndex: number;
        endIndex: number;
        text: string;
    };
    groundingChunkIndices?: number[];
    confidenceScores?: number[];
}

// ============================================================================
// PHI/PII Sanitizer Types
// ============================================================================

export interface SanitizerResult {
    isClean: boolean;
    containsPHI: boolean;
    violations: PHIViolation[];
    sanitizedText?: string;
}

export interface PHIViolation {
    type: PHIType;
    pattern: string;
    matchedText: string;
    startIndex: number;
    endIndex: number;
    severity: 'critical' | 'warning';
    suggestion: string;
}

export type PHIType =
    | 'MRN'
    | 'SSN'
    | 'DOB'
    | 'PatientName'
    | 'PhoneNumber'
    | 'Email'
    | 'Address'
    | 'ServiceDate'
    | 'Age89Plus'
    | 'Other';

// ============================================================================
// Cost Tracking Types
// ============================================================================

export interface CostStats {
    currentMonth: string;
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    totalCost: number;
    requestCount: number;
    lastUpdated: string;
}

export interface TokenPricing {
    inputPerMillion: number;
    outputPerMillion: number;
    thinkingPerMillion: number;
}

export const GEMINI_PRICING: Record<GeminiModel, TokenPricing> = {
    // TODO: Replace placeholder pricing with official Gemini 3 Pro rates.
    'gemini-3-pro-preview': {
        inputPerMillion: 0.10,
        outputPerMillion: 0.40,
        thinkingPerMillion: 0.40,
    },
    'gemini-3-flash-preview': {
        inputPerMillion: 0.10,
        outputPerMillion: 0.40,
        thinkingPerMillion: 0.40,
    },
    'gemini-flash-latest': {
        inputPerMillion: 0.10,
        outputPerMillion: 0.40,
        thinkingPerMillion: 0.40,
    },
    'gemini-flash-lite-latest': {
        inputPerMillion: 0.10,
        outputPerMillion: 0.40,
        thinkingPerMillion: 0.40,
    },
};

// ============================================================================
// Research Insight Types
// ============================================================================

export interface ResearchInsightRequest {
    entry: string;
    options: ResearchInsightOptions;
}

export interface ResearchInsightOptions {
    thinkingLevel?: ThinkingLevel;
    enableGrounding?: boolean;
    enablePubMed?: boolean;
    enableCodeAudit?: boolean;
    enableFrameAnalysis?: boolean;
    enableVaultConnector?: boolean;
    enableFiveWhys?: boolean;
    enableShadowPrompt?: boolean;
}

export interface ResearchInsightResult {
    success: boolean;
    summary: InvertedPyramidSummary;
    grounding?: GroundingResult;
    pubmedArticles?: PubMedArticle[];
    codeAudit?: CodeAuditResult;
    frameAnalysis?: FrameAnalysisResult;
    vaultConnections?: VaultConnection[];
    fiveWhys?: FiveWhysResult;
    shadowPrompt?: ShadowPromptResult;
    usage: TokenUsage;
    processingTime: number;
    error?: string;
}

export interface InvertedPyramidSummary {
    lead: string;      // Most important insight (1 sentence)
    body: string;      // Supporting context (1 sentence)
    tail: string;      // Implications/next steps (1 sentence)
    fullSummary: string;
}

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    totalTokens: number;
    estimatedCost: number;
}

// ============================================================================
// Grounding Types
// ============================================================================

export interface GroundingResult {
    enabled: boolean;
    sources: GroundingSource[];
    verifiedClaims: VerifiedClaim[];
    searchQueries: string[];
}

export interface GroundingSource {
    url: string;
    title: string;
    relevance: number;
}

export interface VerifiedClaim {
    claim: string;
    status: 'verified' | 'partially_verified' | 'unverified' | 'contradicted';
    sources: string[];
    confidence: number;
}

// ============================================================================
// PubMed Types
// ============================================================================

export interface PubMedArticle {
    pmid: string;
    title: string;
    authors: string[];
    journal: string;
    publicationDate: string;
    doi?: string;
    abstract?: string;
    relevanceNote: string;
}

export interface PubMedSearchQuery {
    terms: string[];
    genes?: string[];
    diseases?: string[];
    methods?: string[];
    dateRange?: {
        from: string;
        to: string;
    };
    maxResults: number;
}

// ============================================================================
// Code Audit Types
// ============================================================================

export interface CodeAuditResult {
    language: CodeLanguage;
    criticalIssues: CodeIssue[];
    warnings: CodeIssue[];
    optimizations: CodeOptimization[];
    checklist: ChecklistItem[];
    overallScore: number;
}

export type CodeLanguage = 'nextflow' | 'python' | 'bash' | 'r' | 'wdl' | 'unknown';

export interface CodeIssue {
    severity: 'critical' | 'warning';
    type: CodeIssueType;
    line?: number;
    code?: string;
    description: string;
    suggestion: string;
}

export type CodeIssueType =
    | 'syntax'
    | 'logic'
    | 'resource'
    | 'security'
    | 'performance'
    | 'compatibility'
    | 'bioinformatics';

export interface CodeOptimization {
    type: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    implementation: string;
}

export interface ChecklistItem {
    item: string;
    checked: boolean;
    note?: string;
}

// ============================================================================
// Frame Analysis Types
// ============================================================================

export interface FrameAnalysisResult {
    dominantFrame: string;
    frames: Frame[];
    biases: CognitiveBias[];
    recommendation: string;
}

export interface Frame {
    name: string;
    description: string;
    strength: number;
    evidence: string[];
}

export interface CognitiveBias {
    type: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
}

// ============================================================================
// Vault Connector Types
// ============================================================================

export interface VaultConnection {
    suggestedNote: string;
    reason: string;
    confidence: number;
    linkType: 'related' | 'reference' | 'follow_up';
}

// ============================================================================
// 5-Whys Types
// ============================================================================

export interface FiveWhysResult {
    problem: string;
    whys: WhyIteration[];
    rootCause: string;
    actionItems: string[];
}

export interface WhyIteration {
    level: number;
    question: string;
    answer: string;
}

// ============================================================================
// Shadow Prompt Types
// ============================================================================

export interface ShadowPromptResult {
    omissions: Omission[];
    provocativeQuestions: string[];
    blindSpots: string[];
}

export interface Omission {
    topic: string;
    importance: 'high' | 'medium' | 'low';
    question: string;
}

// ============================================================================
// Backup Types
// ============================================================================

export interface BackupManifest {
    version: string;
    timestamp: string;
    fileCount: number;
    totalSize: number;
    files: BackupFile[];
}

export interface BackupFile {
    path: string;
    size: number;
    modified: string;
    hash?: string;
}

// ============================================================================
// Content Analysis Types
// ============================================================================

export interface ContentAnalysis {
    wordCount: number;
    hasCodeBlocks: boolean;
    codeLanguages: CodeLanguage[];
    hasClinicalClaims: boolean;
    hasBiomedicalTerms: boolean;
    hasStatistics: boolean;
    geneCount: number;
    genes: string[];
    containsPHI: boolean;
    complexityScore: number;
    suggestedThinkingLevel: ThinkingLevel;
}

// ============================================================================
// UI Types
// ============================================================================

export interface ModalOptions {
    title: string;
    content: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
}

export interface NotificationOptions {
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
}
