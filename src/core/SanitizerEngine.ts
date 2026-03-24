/**
 * SanitizerEngine - PHI/PII Detection for HIPAA Compliance
 *
 * This engine MUST run before every API call to prevent PHI leakage.
 * False positives are acceptable; false negatives are not.
 */

import { SanitizerResult, PHIViolation, PHIType } from '../types';

interface PHIPattern {
    type: PHIType;
    pattern: RegExp;
    severity: 'critical' | 'warning';
    description: string;
    suggestion: string;
}

export class SanitizerEngine {
    private patterns: PHIPattern[];
    private excludePatterns: RegExp[];

    constructor() {
        this.patterns = this.initializePatterns();
        this.excludePatterns = this.initializeExcludePatterns();
    }

    /**
     * Initialize PHI detection patterns
     * Patterns are ordered by severity and likelihood
     */
    private initializePatterns(): PHIPattern[] {
        return [
            // Critical PHI Patterns
            {
                type: 'SSN',
                pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi,
                severity: 'critical',
                description: 'Social Security Number detected',
                suggestion: 'Remove SSN completely - use "[SSN REDACTED]" if reference needed'
            },
            {
                type: 'MRN',
                pattern: /\b(?:MRN|Medical Record(?:\s+Number)?|Patient\s+ID)[\s:]*[#]?\s*(\d{5,12})\b/gi,
                severity: 'critical',
                description: 'Medical Record Number detected',
                suggestion: 'Remove MRN - use de-identified case number if needed'
            },
            {
                type: 'MRN',
                pattern: /\b(?:chart|case|record)\s*(?:#|number|no\.?)[\s:]*(\d{5,12})\b/gi,
                severity: 'critical',
                description: 'Potential Medical Record Number detected',
                suggestion: 'Verify this is not a patient identifier'
            },
            {
                type: 'DOB',
                pattern: /\b(?:DOB|Date\s+of\s+Birth|Birth\s*Date|Born)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/gi,
                severity: 'critical',
                description: 'Date of Birth detected',
                suggestion: 'Remove specific DOB - use age range if needed'
            },
            {
                type: 'PatientName',
                pattern: /\b(?:patient|pt\.?|case)\s+(?:name[\s:]*)?([A-Z][a-z]+\s+[A-Z][a-z]+)\b/gi,
                severity: 'critical',
                description: 'Patient name with clinical context detected',
                suggestion: 'Replace with "Patient A" or anonymized identifier'
            },
            {
                type: 'PatientName',
                pattern: /\b(?:saw|examined|treated|evaluated|diagnosed|counseled)\s+(?:patient\s+)?([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\b/gi,
                severity: 'critical',
                description: 'Patient name with clinical action detected',
                suggestion: 'Replace name with anonymized identifier'
            },
            {
                type: 'PhoneNumber',
                pattern: /\b(?:phone|tel|call|contact)[\s:]*(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/gi,
                severity: 'critical',
                description: 'Phone number detected',
                suggestion: 'Remove phone number completely'
            },
            {
                type: 'PhoneNumber',
                pattern: /\b\(?(\d{3})\)?[-.\s](\d{3})[-.\s](\d{4})\b/g,
                severity: 'warning',
                description: 'Potential phone number pattern detected',
                suggestion: 'Verify this is not a patient phone number'
            },
            {
                type: 'Email',
                pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
                severity: 'warning',
                description: 'Email address detected',
                suggestion: 'Remove email if patient-related'
            },
            {
                type: 'Address',
                pattern: /\b(\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Ct|Court|Way|Place|Pl))(?:\s*,?\s*(?:Apt|Suite|Unit|#)\s*\d+)?\b/gi,
                severity: 'warning',
                description: 'Street address detected',
                suggestion: 'Remove specific address - use city/region if needed'
            },
            {
                type: 'ServiceDate',
                pattern: /\b(?:seen|visit(?:ed)?|admitted|discharged|appointment)\s+(?:on\s+)?(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/gi,
                severity: 'warning',
                description: 'Service date detected',
                suggestion: 'Generalize date to month/year or relative timeframe'
            },
            {
                type: 'Age89Plus',
                pattern: /\b(?:age[sd]?|aged|years?\s+old)[\s:]*([89]\d|1[0-4]\d)\b/gi,
                severity: 'warning',
                description: 'Age 89+ detected (HIPAA Safe Harbor)',
                suggestion: 'Replace with "90+" per HIPAA Safe Harbor guidelines'
            },
            {
                type: 'Age89Plus',
                pattern: /\b([89]\d|1[0-4]\d)[\s-]?(?:year|yr|y\.?o\.?)[\s-]?(?:old)?\b/gi,
                severity: 'warning',
                description: 'Age 89+ years detected',
                suggestion: 'Replace with "90+" per HIPAA Safe Harbor guidelines'
            },
        ];
    }

    /**
     * Patterns to exclude from PHI detection (legitimate research content)
     */
    private initializeExcludePatterns(): RegExp[] {
        return [
            // Research codes and identifiers
            /\b(?:PMID|DOI|NCBI|RefSeq|GenBank|UniProt|Ensembl)[\s:]*\d+/gi,
            // Accession numbers
            /\b[A-Z]{1,3}_?\d{5,10}(?:\.\d+)?\b/g,
            // Gene coordinates
            /\bchr\d{1,2}:\d+[-:]\d+\b/gi,
            // dbSNP IDs
            /\brs\d{5,12}\b/gi,
            // P-values and statistics
            /\bp[\s]*[<>=]\s*[\d.e-]+\b/gi,
            // Sample IDs (common patterns)
            /\b(?:sample|specimen|ID)[-_]?\d{3,8}\b/gi,
            // Reference genome builds
            /\b(?:hg\d{2}|GRCh\d{2})\b/gi,
            // Tool versions
            /\bv?\d+\.\d+(?:\.\d+)?\b/g,
            // Memory specifications
            /\b\d+\s*(?:GB|MB|TB|KB)\b/gi,
            // Time specifications
            /\b\d+\s*(?:hours?|hrs?|minutes?|mins?|seconds?|secs?|ms)\b/gi,
        ];
    }

    /**
     * Scan text for PHI/PII violations
     * @param text The text to scan
     * @returns SanitizerResult with violations and clean status
     */
    public scan(text: string): SanitizerResult {
        const violations: PHIViolation[] = [];
        const excludedRanges = this.findExcludedRanges(text);

        for (const patternDef of this.patterns) {
            const matches = text.matchAll(patternDef.pattern);

            for (const match of matches) {
                const startIndex = match.index || 0;
                const endIndex = startIndex + match[0].length;

                // Skip if match is in excluded range
                if (this.isInExcludedRange(startIndex, endIndex, excludedRanges)) {
                    continue;
                }

                // Skip if match is very short (likely false positive)
                if (match[0].length < 3) {
                    continue;
                }

                violations.push({
                    type: patternDef.type,
                    pattern: patternDef.pattern.source,
                    matchedText: match[0],
                    startIndex,
                    endIndex,
                    severity: patternDef.severity,
                    suggestion: patternDef.suggestion
                });
            }

            // Reset regex lastIndex for global patterns
            patternDef.pattern.lastIndex = 0;
        }

        // Deduplicate violations (some patterns may overlap)
        const uniqueViolations = this.deduplicateViolations(violations);

        return {
            isClean: uniqueViolations.length === 0,
            containsPHI: uniqueViolations.some(v => v.severity === 'critical'),
            violations: uniqueViolations,
        };
    }

    /**
     * Auto-anonymize text by redacting detected PHI/PII
     */
    public anonymizeText(text: string, violations?: PHIViolation[]): string {
        const list = violations && violations.length > 0 ? violations : this.scan(text).violations;
        if (list.length === 0) {
            return text;
        }

        // Replace from end to start to preserve indices
        const sorted = [...list].sort((a, b) => b.startIndex - a.startIndex);
        let output = text;
        for (const v of sorted) {
            const replacement = `[REDACTED:${v.type}]`;
            output = output.slice(0, v.startIndex) + replacement + output.slice(v.endIndex);
        }
        return output;
    }

    /**
     * Find ranges that should be excluded from PHI detection
     */
    private findExcludedRanges(text: string): Array<[number, number]> {
        const ranges: Array<[number, number]> = [];

        for (const pattern of this.excludePatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const start = match.index || 0;
                const end = start + match[0].length;
                ranges.push([start, end]);
            }
            // Reset regex lastIndex
            pattern.lastIndex = 0;
        }

        // Also exclude code blocks (content between ``` markers)
        const codeBlockPattern = /```[\s\S]*?```/g;
        const codeMatches = text.matchAll(codeBlockPattern);
        for (const match of codeMatches) {
            const start = match.index || 0;
            const end = start + match[0].length;
            ranges.push([start, end]);
        }

        return ranges;
    }

    /**
     * Check if a range overlaps with any excluded range
     */
    private isInExcludedRange(
        start: number,
        end: number,
        excludedRanges: Array<[number, number]>
    ): boolean {
        for (const [exStart, exEnd] of excludedRanges) {
            if (start >= exStart && end <= exEnd) {
                return true;
            }
        }
        return false;
    }

    /**
     * Remove duplicate violations (same text at same position)
     */
    private deduplicateViolations(violations: PHIViolation[]): PHIViolation[] {
        const seen = new Set<string>();
        const unique: PHIViolation[] = [];

        for (const v of violations) {
            const key = `${v.startIndex}-${v.endIndex}-${v.matchedText}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(v);
            }
        }

        // Sort by severity (critical first) then by position
        return unique.sort((a, b) => {
            if (a.severity !== b.severity) {
                return a.severity === 'critical' ? -1 : 1;
            }
            return a.startIndex - b.startIndex;
        });
    }

    /**
     * Generate a human-readable report of violations
     */
    public generateReport(result: SanitizerResult): string {
        if (result.isClean) {
            return '✅ No PHI/PII detected. Content is safe to process.';
        }

        const lines: string[] = [];
        lines.push('⚠️ PHI/PII DETECTED - Review Required\n');

        const critical = result.violations.filter(v => v.severity === 'critical');
        const warnings = result.violations.filter(v => v.severity === 'warning');

        if (critical.length > 0) {
            lines.push('🚨 CRITICAL VIOLATIONS (must be removed):');
            for (const v of critical) {
                lines.push(`  • ${v.type}: "${v.matchedText}"`);
                lines.push(`    → ${v.suggestion}`);
            }
            lines.push('');
        }

        if (warnings.length > 0) {
            lines.push('⚡ WARNINGS (review recommended):');
            for (const v of warnings) {
                lines.push(`  • ${v.type}: "${v.matchedText}"`);
                lines.push(`    → ${v.suggestion}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Quick check if text contains any PHI (for performance)
     */
    public quickCheck(text: string): boolean {
        // Check critical patterns only for quick scan
        const criticalPatterns = this.patterns.filter(p => p.severity === 'critical');

        for (const patternDef of criticalPatterns) {
            if (patternDef.pattern.test(text)) {
                patternDef.pattern.lastIndex = 0;
                return true;
            }
            patternDef.pattern.lastIndex = 0;
        }

        return false;
    }

    /**
     * Sanitize text by replacing PHI with placeholders
     * Note: This should only be used for display, not for skipping PHI checks
     */
    public sanitize(text: string): { sanitized: string; redactionCount: number } {
        const result = this.scan(text);
        let sanitized = text;
        let redactionCount = 0;

        // Sort violations by position (reverse order to preserve indices)
        const sortedViolations = [...result.violations].sort(
            (a, b) => b.startIndex - a.startIndex
        );

        for (const violation of sortedViolations) {
            const placeholder = `[${violation.type} REDACTED]`;
            sanitized =
                sanitized.slice(0, violation.startIndex) +
                placeholder +
                sanitized.slice(violation.endIndex);
            redactionCount++;
        }

        return { sanitized, redactionCount };
    }
}
