/**
 * CostTracker - Real-time Token Usage and Budget Management
 *
 * Tracks all API costs, enforces monthly budget limits, and provides
 * usage projections. Data persists to localStorage with monthly auto-reset.
 */

import { CostStats, TokenUsage, GeminiModel, GEMINI_PRICING } from '../types';

const STORAGE_KEY = 'gemini-research-brain-costs';

export class CostTracker {
    private stats: CostStats;
    private monthlyBudget: number;
    private alertThreshold: number;
    private onBudgetAlert?: (percentage: number) => void;

    constructor(monthlyBudget: number = 100, alertThreshold: number = 80) {
        this.monthlyBudget = monthlyBudget;
        this.alertThreshold = alertThreshold;
        this.stats = this.loadStats();
        this.checkMonthRollover();
    }

    /**
     * Load stats from localStorage or initialize fresh
     */
    private loadStats(): CostStats {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored) as CostStats;
            }
        } catch (error) {
            console.error('Failed to load cost stats:', error);
        }

        return this.createFreshStats();
    }

    /**
     * Create a fresh stats object for new month
     */
    private createFreshStats(): CostStats {
        const now = new Date();
        return {
            currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            inputTokens: 0,
            outputTokens: 0,
            thinkingTokens: 0,
            totalCost: 0,
            requestCount: 0,
            lastUpdated: now.toISOString(),
        };
    }

    /**
     * Check if month has changed and reset if needed
     */
    private checkMonthRollover(): void {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (this.stats.currentMonth !== currentMonth) {
            this.stats = this.createFreshStats();
            this.saveStats();
        }
    }

    /**
     * Save stats to localStorage
     */
    private saveStats(): void {
        try {
            this.stats.lastUpdated = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
        } catch (error) {
            console.error('Failed to save cost stats:', error);
        }
    }

    /**
     * Calculate cost for token usage
     */
    public calculateCost(
        model: GeminiModel,
        inputTokens: number,
        outputTokens: number,
        thinkingTokens: number = 0
    ): number {
        const pricing = GEMINI_PRICING[model];

        const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
        const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
        const thinkingCost = (thinkingTokens / 1_000_000) * pricing.thinkingPerMillion;

        return inputCost + outputCost + thinkingCost;
    }

    /**
     * Record a new API call's token usage
     */
    public recordUsage(
        model: GeminiModel,
        inputTokens: number,
        outputTokens: number,
        thinkingTokens: number = 0
    ): TokenUsage {
        this.checkMonthRollover();

        const cost = this.calculateCost(model, inputTokens, outputTokens, thinkingTokens);

        this.stats.inputTokens += inputTokens;
        this.stats.outputTokens += outputTokens;
        this.stats.thinkingTokens += thinkingTokens;
        this.stats.totalCost += cost;
        this.stats.requestCount += 1;

        this.saveStats();
        this.checkBudgetAlert();

        return {
            inputTokens,
            outputTokens,
            thinkingTokens,
            totalTokens: inputTokens + outputTokens + thinkingTokens,
            estimatedCost: cost,
        };
    }

    /**
     * Check if budget alert should be triggered
     */
    private checkBudgetAlert(): void {
        const percentage = this.getBudgetUsagePercentage();
        if (percentage >= this.alertThreshold && this.onBudgetAlert) {
            this.onBudgetAlert(percentage);
        }
    }

    /**
     * Set callback for budget alerts
     */
    public setAlertCallback(callback: (percentage: number) => void): void {
        this.onBudgetAlert = callback;
    }

    /**
     * Update budget configuration
     */
    public updateBudget(monthlyBudget: number, alertThreshold: number): void {
        this.monthlyBudget = monthlyBudget;
        this.alertThreshold = alertThreshold;
    }

    /**
     * Get current budget usage percentage
     */
    public getBudgetUsagePercentage(): number {
        return (this.stats.totalCost / this.monthlyBudget) * 100;
    }

    /**
     * Check if budget is exhausted (hard limit)
     */
    public isBudgetExhausted(): boolean {
        return this.stats.totalCost >= this.monthlyBudget;
    }

    /**
     * Get remaining budget
     */
    public getRemainingBudget(): number {
        return Math.max(0, this.monthlyBudget - this.stats.totalCost);
    }

    /**
     * Get current stats
     */
    public getStats(): CostStats {
        this.checkMonthRollover();
        return { ...this.stats };
    }

    /**
     * Get average cost per request
     */
    public getAverageCostPerRequest(): number {
        if (this.stats.requestCount === 0) return 0;
        return this.stats.totalCost / this.stats.requestCount;
    }

    /**
     * Project end-of-month cost based on current usage
     */
    public getProjectedMonthlySpend(): number {
        const now = new Date();
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        if (dayOfMonth === 0) return 0;

        const dailyAverage = this.stats.totalCost / dayOfMonth;
        return dailyAverage * daysInMonth;
    }

    /**
     * Get formatted stats for display
     */
    public getFormattedStats(): {
        spent: string;
        remaining: string;
        percentage: string;
        projected: string;
        requests: number;
        avgCost: string;
    } {
        return {
            spent: `$${this.stats.totalCost.toFixed(2)}`,
            remaining: `$${this.getRemainingBudget().toFixed(2)}`,
            percentage: `${this.getBudgetUsagePercentage().toFixed(1)}%`,
            projected: `$${this.getProjectedMonthlySpend().toFixed(2)}`,
            requests: this.stats.requestCount,
            avgCost: `$${this.getAverageCostPerRequest().toFixed(3)}`,
        };
    }

    /**
     * Get detailed token breakdown
     */
    public getTokenBreakdown(model: GeminiModel): {
        input: { tokens: number; cost: string };
        output: { tokens: number; cost: string };
        thinking: { tokens: number; cost: string };
        total: { tokens: number; cost: string };
    } {
        const pricing = GEMINI_PRICING[model];

        const inputCost = (this.stats.inputTokens / 1_000_000) * pricing.inputPerMillion;
        const outputCost = (this.stats.outputTokens / 1_000_000) * pricing.outputPerMillion;
        const thinkingCost = (this.stats.thinkingTokens / 1_000_000) * pricing.thinkingPerMillion;

        return {
            input: {
                tokens: this.stats.inputTokens,
                cost: `$${inputCost.toFixed(4)}`,
            },
            output: {
                tokens: this.stats.outputTokens,
                cost: `$${outputCost.toFixed(4)}`,
            },
            thinking: {
                tokens: this.stats.thinkingTokens,
                cost: `$${thinkingCost.toFixed(4)}`,
            },
            total: {
                tokens: this.stats.inputTokens + this.stats.outputTokens + this.stats.thinkingTokens,
                cost: `$${this.stats.totalCost.toFixed(4)}`,
            },
        };
    }

    /**
     * Reset stats (for testing or manual reset)
     */
    public reset(): void {
        this.stats = this.createFreshStats();
        this.saveStats();
    }

    /**
     * Generate a budget report string
     */
    public generateReport(model: GeminiModel): string {
        const stats = this.getFormattedStats();
        const breakdown = this.getTokenBreakdown(model);

        const lines = [
            '📊 Gemini Research Brain - Cost Report',
            '═'.repeat(40),
            '',
            `📅 Month: ${this.stats.currentMonth}`,
            `🔢 Total Requests: ${stats.requests}`,
            '',
            '💰 BUDGET STATUS',
            `   Spent: ${stats.spent} of $${this.monthlyBudget.toFixed(2)}`,
            `   Remaining: ${stats.remaining}`,
            `   Usage: ${stats.percentage}`,
            `   Projected: ${stats.projected}/month`,
            '',
            '🔤 TOKEN BREAKDOWN',
            `   Input:    ${breakdown.input.tokens.toLocaleString()} tokens (${breakdown.input.cost})`,
            `   Output:   ${breakdown.output.tokens.toLocaleString()} tokens (${breakdown.output.cost})`,
            `   Thinking: ${breakdown.thinking.tokens.toLocaleString()} tokens (${breakdown.thinking.cost})`,
            `   Total:    ${breakdown.total.tokens.toLocaleString()} tokens`,
            '',
            `📈 Average Cost: ${stats.avgCost}/request`,
        ];

        if (this.getBudgetUsagePercentage() >= this.alertThreshold) {
            lines.push('');
            lines.push(`⚠️ WARNING: Budget usage at ${stats.percentage}`);
        }

        if (this.isBudgetExhausted()) {
            lines.push('');
            lines.push('🚫 BUDGET EXHAUSTED - Processing disabled');
        }

        return lines.join('\n');
    }

    /**
     * Estimate cost for a potential request
     */
    public estimateCost(
        model: GeminiModel,
        estimatedInputTokens: number,
        estimatedOutputTokens: number,
        useThinking: boolean = false
    ): { cost: number; withinBudget: boolean; remainingAfter: number } {
        const thinkingTokens = useThinking ? estimatedOutputTokens * 2 : 0;
        const cost = this.calculateCost(model, estimatedInputTokens, estimatedOutputTokens, thinkingTokens);

        const remaining = this.getRemainingBudget();
        const withinBudget = cost <= remaining;
        const remainingAfter = remaining - cost;

        return {
            cost,
            withinBudget,
            remainingAfter: Math.max(0, remainingAfter),
        };
    }
}
