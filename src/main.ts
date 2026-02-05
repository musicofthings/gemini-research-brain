/**
 * Gemini Research Brain - Main Plugin Entry Point
 *
 * AI-powered research journaling for physician-scientists.
 * Features: Inverted Pyramid analysis, PHI sanitization, cost tracking,
 * Google Search grounding, PubMed integration, and code auditing.
 */

import {
    App,
    Editor,
    MarkdownView,
    Notice,
    Plugin,
    PluginManifest,
} from 'obsidian';

import { GeminiResearchBrainSettings, DEFAULT_SETTINGS } from './types';
import { SanitizerEngine } from './core/SanitizerEngine';
import { CostTracker } from './core/CostTracker';
import { GeminiProvider } from './core/GeminiProvider';
import { BackupManager } from './utils/BackupManager';
import { GeminiResearchBrainSettingsTab } from './ui/SettingsTab';
import {
    InsightModal,
    PHIWarningModal,
    BudgetWarningModal,
    LoadingModal
} from './ui/InsightModal';

// System prompts - will be loaded from files
import { SYSTEM_INSTRUCTION } from './prompts/system-instruction';
import { MEDICAL_RESEARCH_MODE } from './prompts/medical-research-mode';
import { CODE_AUDITOR_MODE } from './prompts/code-auditor-mode';

export default class GeminiResearchBrainPlugin extends Plugin {
    settings: GeminiResearchBrainSettings;
    sanitizer: SanitizerEngine;
    costTracker: CostTracker;
    geminiProvider: GeminiProvider;
    backupManager: BackupManager;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        this.settings = DEFAULT_SETTINGS;
        this.sanitizer = new SanitizerEngine();
        this.costTracker = new CostTracker();
        this.geminiProvider = new GeminiProvider(
            this.settings,
            this.sanitizer,
            this.costTracker
        );
        this.backupManager = new BackupManager(app);
    }

    async onload(): Promise<void> {
        // Load settings
        await this.loadSettings();

        // Initialize components with settings
        this.costTracker = new CostTracker(
            this.settings.monthlyBudget,
            this.settings.budgetAlertThreshold
        );
        this.geminiProvider = new GeminiProvider(
            this.settings,
            this.sanitizer,
            this.costTracker
        );
        this.backupManager = new BackupManager(this.app, this.settings.backupLocation);

        // Load system prompts
        await this.geminiProvider.loadSystemPrompts(
            SYSTEM_INSTRUCTION,
            MEDICAL_RESEARCH_MODE,
            CODE_AUDITOR_MODE
        );

        // Set up budget alert callback
        this.costTracker.setAlertCallback((percentage) => {
            new Notice(`⚠️ Budget alert: You've used ${percentage.toFixed(1)}% of your monthly budget.`);
        });

        // Add settings tab
        this.addSettingTab(new GeminiResearchBrainSettingsTab(this.app, this));

        // Register commands
        this.registerCommands();

        // Add ribbon icon
        this.addRibbonIcon('brain', 'Generate Research Insight', async () => {
            await this.generateInsightForActiveNote();
        });

    }

    onunload(): void {
    }

    /**
     * Register plugin commands
     */
    private registerCommands(): void {
        // Main command: Generate insight
        this.addCommand({
            id: 'generate-insight',
            name: 'Generate Research Insight',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                await this.generateInsight(editor, view);
            }
        });

        // Generate insight for selection
        this.addCommand({
            id: 'generate-insight-selection',
            name: 'Generate Insight for Selection',
            editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
                const hasSelection = editor.somethingSelected();
                if (checking) {
                    return hasSelection;
                }
                if (hasSelection) {
                    this.generateInsightForSelection(editor, view);
                }
                return true;
            }
        });

        // Scan for PHI
        this.addCommand({
            id: 'scan-phi',
            name: 'Scan Note for PHI/PII',
            editorCallback: async (editor: Editor) => {
                await this.scanForPHI(editor);
            }
        });

        // Show cost report
        this.addCommand({
            id: 'show-cost-report',
            name: 'Show Cost Report',
            callback: () => {
                this.showCostReport();
            }
        });

        // Test API connection
        this.addCommand({
            id: 'test-api-connection',
            name: 'Test API Connection',
            callback: async () => {
                await this.testConnection();
            }
        });
    }

    /**
     * Generate insight for active note
     */
    private async generateInsightForActiveNote(): Promise<void> {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            new Notice('No active note to analyze.');
            return;
        }

        const editor = view.editor;
        await this.generateInsight(editor, view);
    }

    /**
     * Main insight generation logic
     */
    private async generateInsight(
        editor: Editor,
        view: MarkdownView,
        skipBudgetWarning: boolean = false
    ): Promise<void> {
        const content = editor.getValue();

        if (!content.trim()) {
            new Notice('Note is empty. Nothing to analyze.');
            return;
        }

        // Check budget before proceeding
        if (this.costTracker.isBudgetExhausted()) {
            const stats = this.costTracker.getFormattedStats();
            new BudgetWarningModal(
                this.app,
                100,
                stats.remaining,
                () => {},
                () => {}
            ).open();
            return;
        }

        const budgetPercentage = this.costTracker.getBudgetUsagePercentage();
        if (!skipBudgetWarning && budgetPercentage >= this.settings.budgetAlertThreshold && budgetPercentage < 100) {
            const stats = this.costTracker.getFormattedStats();
            new BudgetWarningModal(
                this.app,
                budgetPercentage,
                stats.remaining,
                () => {
                    this.generateInsight(editor, view, true);
                },
                () => {}
            ).open();
            return;
        }

        // Show loading modal
        const loadingModal = new LoadingModal(this.app);
        loadingModal.open();

        try {
            // Generate insight
            const result = await this.geminiProvider.generateResearchInsight(content);

            // Close loading modal
            loadingModal.close();

            // Format result as markdown
            const markdownContent = this.geminiProvider.formatResultAsMarkdown(result);

            // Show preview or auto-insert
            const isMobile = this.isMobileDevice();
            if (this.settings.showPreviewModal && !(isMobile && this.settings.autoInsertOnMobile)) {
                new InsightModal(
                    this.app,
                    result,
                    markdownContent,
                    (finalContent) => {
                        this.insertInsight(editor, finalContent);
                    },
                    () => {
                        new Notice('Insight generation cancelled.');
                    }
                ).open();
            } else {
                // Auto-insert
                this.insertInsight(editor, markdownContent);
            }

            // Backup if enabled
            if (this.settings.enableAutoBackup && view.file) {
                await this.backupManager.backupInsight(view.file.path, markdownContent);
            }

        } catch (error) {
            loadingModal.close();

            const errorMessage = (error as Error).message;

            // Check if PHI error
            if (errorMessage.includes('PHI/PII Detected')) {
                new PHIWarningModal(
                    this.app,
                    errorMessage,
                    () => {}
                ).open();
            } else {
                new Notice(`❌ ${errorMessage}`);
            }

            if (this.settings.debugMode) {
                console.error('Insight generation failed:', error);
            }
        }
    }

    /**
     * Generate insight for selected text
     */
    private async generateInsightForSelection(
        editor: Editor,
        view: MarkdownView,
        skipBudgetWarning: boolean = false
    ): Promise<void> {
        const selection = editor.getSelection();

        if (!selection.trim()) {
            new Notice('Selection is empty.');
            return;
        }

        // Check budget
        if (this.costTracker.isBudgetExhausted()) {
            const stats = this.costTracker.getFormattedStats();
            new BudgetWarningModal(
                this.app,
                100,
                stats.remaining,
                () => {},
                () => {}
            ).open();
            return;
        }

        const budgetPercentage = this.costTracker.getBudgetUsagePercentage();
        if (!skipBudgetWarning && budgetPercentage >= this.settings.budgetAlertThreshold && budgetPercentage < 100) {
            const stats = this.costTracker.getFormattedStats();
            new BudgetWarningModal(
                this.app,
                budgetPercentage,
                stats.remaining,
                () => {
                    this.generateInsightForSelection(editor, view, true);
                },
                () => {}
            ).open();
            return;
        }

        const loadingModal = new LoadingModal(this.app, 'Analyzing selection...');
        loadingModal.open();

        try {
            const result = await this.geminiProvider.generateResearchInsight(selection);
            loadingModal.close();

            const markdownContent = this.geminiProvider.formatResultAsMarkdown(result);

            new InsightModal(
                this.app,
                result,
                markdownContent,
                (finalContent) => {
                    // Replace selection with insight
                    editor.replaceSelection(`${selection}\n\n${finalContent}`);
                    new Notice('✅ Insight added!');
                },
                () => {
                    new Notice('Insight generation cancelled.');
                }
            ).open();

        } catch (error) {
            loadingModal.close();
            const errorMessage = (error as Error).message;

            if (errorMessage.includes('PHI/PII Detected')) {
                new PHIWarningModal(this.app, errorMessage, () => {}).open();
            } else {
                new Notice(`❌ ${errorMessage}`);
            }
        }
    }

    /**
     * Insert insight at end of note
     */
    private insertInsight(editor: Editor, content: string): void {
        const currentContent = editor.getValue();
        const newContent = currentContent.trim() + '\n\n' + content;
        editor.setValue(newContent);

        // Move cursor to end
        const lines = newContent.split('\n');
        editor.setCursor({ line: lines.length - 1, ch: lines[lines.length - 1].length });

        new Notice('✅ Research insight added!');
    }

    /**
     * Scan note for PHI/PII
     */
    private async scanForPHI(editor: Editor): Promise<void> {
        const content = editor.getValue();
        const result = this.sanitizer.scan(content);
        const report = this.sanitizer.generateReport(result);

        if (result.isClean) {
            new Notice('✅ No PHI/PII detected. Note is safe to process.');
        } else {
            new PHIWarningModal(this.app, report, () => {}).open();
        }
    }

    /**
     * Show cost report
     */
    private showCostReport(): void {
        const report = this.costTracker.generateReport(this.settings.model);
        new Notice(report, 10000);
    }

    /**
     * Test API connection
     */
    private async testConnection(): Promise<void> {
        new Notice('Testing API connection...');
        const result = await this.geminiProvider.testConnection();
        new Notice(result.message);
    }

    /**
     * Check if running on mobile device
     */
    private isMobileDevice(): boolean {
        // @ts-ignore - Obsidian internal API
        return this.app.isMobile || false;
    }

    /**
     * Load settings from storage
     */
    async loadSettings(): Promise<void> {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }

    /**
     * Save settings to storage
     */
    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);

        // Update components with new settings
        this.geminiProvider.updateSettings(this.settings);
        this.costTracker.updateBudget(
            this.settings.monthlyBudget,
            this.settings.budgetAlertThreshold
        );
        this.backupManager.setBackupFolder(this.settings.backupLocation);
    }
}
