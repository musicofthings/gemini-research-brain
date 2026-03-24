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

import { GeminiResearchBrainSettings, DEFAULT_SETTINGS, PHIViolation, ResearchInsightOptions } from './types';
import { SanitizerEngine } from './core/SanitizerEngine';
import { CostTracker } from './core/CostTracker';
import { GeminiProvider } from './core/GeminiProvider';
import { BackupManager } from './utils/BackupManager';
import { GeminiResearchBrainSettingsTab } from './ui/SettingsTab';
import {
    InsightModal,
    PHIWarningModal,
    BudgetWarningModal,
    LoadingModal,
    InsightConfigModal,
    InsightAlgorithmOption
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
    private voiceDictationInstance: any = null;
    private isDictating: boolean = false;
    private phiViolations: PHIViolation[] = [];
    private phiViolationIndex: number = 0;
    private phiEditor: Editor | null = null;
    private phiContent: string = '';
    private phiKeyHandler: ((ev: KeyboardEvent) => void) | null = null;
    private dictationEditor: Editor | null = null;

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


        // Add ribbon icon for research insight (opens config modal)
        this.addRibbonIcon('brain', 'Generate Research Insight', async () => {
            await this.openInsightConfigModal('note');
        });

        // Add ribbon mic icon for dictation
        this.addRibbonIcon('microphone', 'Start/Stop Voice Dictation', async () => {
            await this.toggleVoiceDictation();
        });

    }

    onunload(): void {
    }

    /**
     * Register plugin commands
     */
    private registerCommands(): void {
        // Voice Dictation Command (for hotkey)
        this.addCommand({
            id: 'toggle-voice-dictation',
            name: 'Start/Stop Voice Dictation',
            hotkeys: [
                {
                    modifiers: ['Mod', 'Shift'],
                    key: 'D'
                }
            ],
            callback: async () => {
                await this.toggleVoiceDictation();
            }
        });
        // Main command: Generate insight
        this.addCommand({
            id: 'generate-insight',
            name: 'Generate Research Insight',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                await this.openInsightConfigModal('note', editor, view);
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
                    this.openInsightConfigModal('selection', editor, view);
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
     * Start or stop voice dictation (UI and logic)
     */
    private async toggleVoiceDictation(): Promise<void> {
        if (!this.settings.enableVoiceDictation) {
            new Notice('🎤 Voice dictation is disabled in settings.');
            return;
        }

        // Lazy load VoiceDictation
        const { VoiceDictation } = await import('./modules/VoiceDictation');
        if (!this.voiceDictationInstance) {
            this.voiceDictationInstance = new VoiceDictation(this, this.settings.apiKey, this.settings.model);
        }
        if (!this.isDictating) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view || !view.editor) {
                new Notice('No active note to insert dictation.');
                return;
            }
            this.dictationEditor = view.editor;
            this.isDictating = true;
            new Notice('🎤 Voice dictation started.');
            await this.voiceDictationInstance.startRecording();
        } else {
            this.isDictating = false;
            new Notice('🛑 Voice dictation stopped.');
            try {
                const audioBlob = await this.voiceDictationInstance.stopRecording();
                if (!audioBlob) {
                    new Notice('No audio captured.');
                    return;
                }
                const transcript = await this.voiceDictationInstance.transcribeAudio(audioBlob);
                if ((this.settings.debugMode)) {
                    console.error('Dictation transcript length:', transcript?.length || 0);
                }
                if (!transcript || !transcript.trim()) {
                    new Notice('No transcript returned. Enable Debug Mode to see the response.');
                    return;
                }
                const targetEditor = this.dictationEditor || this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
                if (targetEditor) {
                    targetEditor.replaceSelection(transcript + '\n');
                    new Notice('📝 Dictation inserted into note.');
                } else {
                    new Notice('No active note to insert dictation.');
                }
            } catch (error) {
                if (this.settings.debugMode) {
                    console.error('Dictation failed:', error);
                }
                new Notice('📝 Dictation failed. See console for details.');
            } finally {
                this.dictationEditor = null;
            }
        }
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
     * Open insight configuration modal before analysis
     */
    private async openInsightConfigModal(
        mode: 'note' | 'selection',
        editor?: Editor,
        view?: MarkdownView
    ): Promise<void> {
        const activeView = view || this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('No active note to analyze.');
            return;
        }
        const activeEditor = editor || activeView.editor;

        const algorithms = this.buildAlgorithmOptions();
        const modal = new InsightConfigModal(
            this.app,
            algorithms,
            async (selected) => {
                if (mode === 'selection') {
                    await this.generateInsightForSelection(activeEditor, activeView, selected.options);
                } else {
                    await this.generateInsight(activeEditor, activeView, selected.options);
                }
            },
            () => {}
        );

        modal.open();
    }

    /**
     * Build cognitive algorithm options for the config modal
     */
    private buildAlgorithmOptions(): InsightAlgorithmOption[] {
        const options: InsightAlgorithmOption[] = [];

        // Standard (use current settings)
        options.push({
            id: 'standard',
            label: 'Standard Research Insight',
            description: 'Uses your enabled modules and default settings.',
            options: {
                enableGrounding: this.settings.enableGrounding,
                enablePubMed: this.settings.enablePubMed,
                enableCodeAudit: this.settings.enableCodeAudit,
                enableFrameAnalysis: this.settings.enableFrameAnalysis,
                enableVaultConnector: this.settings.enableVaultConnector,
                enableFiveWhys: this.settings.enableFiveWhys,
                enableShadowPrompt: this.settings.enableShadowPrompt,
            }
        });

        // Inverted Pyramid Only
        options.push({
            id: 'inverted-pyramid',
            label: 'Inverted Pyramid Summary Only',
            description: 'Generate only the 3-sentence executive summary.',
            options: {
                enableGrounding: false,
                enablePubMed: false,
                enableCodeAudit: false,
                enableFrameAnalysis: false,
                enableVaultConnector: false,
                enableFiveWhys: false,
                enableShadowPrompt: false,
            }
        });

        if (this.settings.enableGrounding) {
            options.push({
                id: 'grounding',
                label: 'Grounding Verification',
                description: 'Verify clinical claims with web sources.',
                options: {
                    enableGrounding: true,
                    enablePubMed: false,
                    enableCodeAudit: false,
                    enableFrameAnalysis: false,
                    enableVaultConnector: false,
                    enableFiveWhys: false,
                    enableShadowPrompt: false,
                }
            });
        }

        if (this.settings.enablePubMed) {
            options.push({
                id: 'pubmed',
                label: 'PubMed Literature Scan',
                description: 'Find and summarize relevant PubMed articles.',
                options: {
                    enableGrounding: false,
                    enablePubMed: true,
                    enableCodeAudit: false,
                    enableFrameAnalysis: false,
                    enableVaultConnector: false,
                    enableFiveWhys: false,
                    enableShadowPrompt: false,
                }
            });
        }

        if (this.settings.enableCodeAudit) {
            options.push({
                id: 'code-audit',
                label: 'Code Auditor',
                description: 'Audit code blocks for bugs and optimization.',
                options: {
                    enableGrounding: false,
                    enablePubMed: false,
                    enableCodeAudit: true,
                    enableFrameAnalysis: false,
                    enableVaultConnector: false,
                    enableFiveWhys: false,
                    enableShadowPrompt: false,
                }
            });
        }

        if (this.settings.enableFrameAnalysis) {
            options.push({
                id: 'frame-analysis',
                label: 'Frame Analysis',
                description: 'Detect cognitive frames and biases.',
                options: {
                    enableGrounding: false,
                    enablePubMed: false,
                    enableCodeAudit: false,
                    enableFrameAnalysis: true,
                    enableVaultConnector: false,
                    enableFiveWhys: false,
                    enableShadowPrompt: false,
                }
            });
        }

        if (this.settings.enableVaultConnector) {
            options.push({
                id: 'vault-connector',
                label: 'Vault Connector',
                description: 'Suggest related notes in your vault.',
                options: {
                    enableGrounding: false,
                    enablePubMed: false,
                    enableCodeAudit: false,
                    enableFrameAnalysis: false,
                    enableVaultConnector: true,
                    enableFiveWhys: false,
                    enableShadowPrompt: false,
                }
            });
        }

        if (this.settings.enableFiveWhys) {
            options.push({
                id: 'five-whys',
                label: '5-Whys Analysis',
                description: 'Root cause analysis for blockers or issues.',
                options: {
                    enableGrounding: false,
                    enablePubMed: false,
                    enableCodeAudit: false,
                    enableFrameAnalysis: false,
                    enableVaultConnector: false,
                    enableFiveWhys: true,
                    enableShadowPrompt: false,
                }
            });
        }

        if (this.settings.enableShadowPrompt) {
            options.push({
                id: 'shadow-prompt',
                label: 'Shadow Prompt',
                description: 'Surface omissions via provocative questions.',
                options: {
                    enableGrounding: false,
                    enablePubMed: false,
                    enableCodeAudit: false,
                    enableFrameAnalysis: false,
                    enableVaultConnector: false,
                    enableFiveWhys: false,
                    enableShadowPrompt: true,
                }
            });
        }

        return options;
    }

    /**
     * Main insight generation logic
     */
    private async generateInsight(
        editor: Editor,
        view: MarkdownView,
        options: ResearchInsightOptions = {}
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
        if (!options.skipBudgetWarning && budgetPercentage >= this.settings.budgetAlertThreshold && budgetPercentage < 100) {
            const stats = this.costTracker.getFormattedStats();
            new BudgetWarningModal(
                this.app,
                budgetPercentage,
                stats.remaining,
                () => {
                    this.generateInsight(editor, view, { ...options, skipBudgetWarning: true });
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
            const result = await this.geminiProvider.generateResearchInsight(content, options);

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
                this.showPhiWorkflow(editor, options, async (nextOptions) => {
                    await this.generateInsight(editor, view, nextOptions);
                });
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
        options: ResearchInsightOptions = {}
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
        if (!options.skipBudgetWarning && budgetPercentage >= this.settings.budgetAlertThreshold && budgetPercentage < 100) {
            const stats = this.costTracker.getFormattedStats();
            new BudgetWarningModal(
                this.app,
                budgetPercentage,
                stats.remaining,
                () => {
                    this.generateInsightForSelection(editor, view, { ...options, skipBudgetWarning: true });
                },
                () => {}
            ).open();
            return;
        }

        const loadingModal = new LoadingModal(this.app, 'Analyzing selection...');
        loadingModal.open();

        try {
            const result = await this.geminiProvider.generateResearchInsight(selection, options);
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
                this.showPhiWorkflow(editor, options, async (nextOptions) => {
                    await this.generateInsightForSelection(editor, view, nextOptions);
                });
            } else {
                new Notice(`❌ ${errorMessage}`);
            }
        }
    }

    /**
     * Show PHI/PII workflow with highlighting and actions
     */
    private showPhiWorkflow(
        editor: Editor,
        baseOptions: ResearchInsightOptions,
        proceed: (options: ResearchInsightOptions) => Promise<void>
    ): void {
        const content = editor.getValue();
        const scanResult = this.sanitizer.scan(content);
        const report = this.sanitizer.generateReport(scanResult);

        this.setupPhiNavigation(editor, content, scanResult.violations);

        const modal = new PHIWarningModal(this.app, report, () => {
            this.clearPhiContext();
        }, {
            violations: scanResult.violations,
            onIgnore: async () => {
                this.clearPhiContext();
                new Notice('⚠️ Proceeding with PHI/PII ignored.');
                await proceed({ ...baseOptions, skipPhiCheck: true });
            },
            onAutoAnonymize: async () => {
                const latestContent = editor.getValue();
                const latestScan = this.sanitizer.scan(latestContent);
                const anonymized = this.sanitizer.anonymizeText(latestContent, latestScan.violations);
                editor.setValue(anonymized);
                new Notice('🧹 Auto-anonymized detected PHI/PII.');
                this.clearPhiContext();
                await proceed({ ...baseOptions, skipPhiCheck: false });
            },
            onNavigate: (direction: 'prev' | 'next') => {
                this.navigatePhi(direction);
            },
            onSubmit: async () => {
                const latestContent = editor.getValue();
                const latestScan = this.sanitizer.scan(latestContent);
                if (latestScan.isClean) {
                    this.clearPhiContext();
                    await proceed({ ...baseOptions, skipPhiCheck: false });
                } else {
                    this.clearPhiContext();
                    this.showPhiWorkflow(editor, baseOptions, proceed);
                }
            }
        });

        modal.open();

        // Highlight first violation
        this.highlightPhiViolation(0);
    }

    private setupPhiNavigation(editor: Editor, content: string, violations: PHIViolation[]): void {
        this.clearPhiContext();
        this.phiEditor = editor;
        this.phiContent = content;
        this.phiViolations = violations;
        this.phiViolationIndex = 0;

        this.phiKeyHandler = (ev: KeyboardEvent) => {
            if (ev.key === 'ArrowLeft') {
                ev.preventDefault();
                this.navigatePhi('prev');
            }
            if (ev.key === 'ArrowRight') {
                ev.preventDefault();
                this.navigatePhi('next');
            }
        };
        window.addEventListener('keydown', this.phiKeyHandler);
    }

    private clearPhiContext(): void {
        if (this.phiKeyHandler) {
            window.removeEventListener('keydown', this.phiKeyHandler);
            this.phiKeyHandler = null;
        }
        this.phiViolations = [];
        this.phiViolationIndex = 0;
        this.phiEditor = null;
        this.phiContent = '';
    }

    private navigatePhi(direction: 'prev' | 'next'): void {
        if (!this.phiEditor || this.phiViolations.length === 0) {
            return;
        }
        const delta = direction === 'next' ? 1 : -1;
        const nextIndex = (this.phiViolationIndex + delta + this.phiViolations.length) % this.phiViolations.length;
        this.highlightPhiViolation(nextIndex);
    }

    private highlightPhiViolation(index: number): void {
        if (!this.phiEditor || this.phiViolations.length === 0) {
            return;
        }
        const safeIndex = Math.max(0, Math.min(index, this.phiViolations.length - 1));
        this.phiViolationIndex = safeIndex;
        const violation = this.phiViolations[safeIndex];
        const start = this.indexToPos(this.phiContent, violation.startIndex);
        const end = this.indexToPos(this.phiContent, violation.endIndex);
        this.phiEditor.setSelection(start, end);
    }

    private indexToPos(text: string, index: number): { line: number; ch: number } {
        const clipped = text.slice(0, Math.max(0, index));
        const lines = clipped.split('\n');
        const line = lines.length - 1;
        const ch = lines[lines.length - 1].length;
        return { line, ch };
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
            this.showPhiWorkflow(editor, {}, async () => {});
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
