/**
 * InsightModal - Preview Modal for Research Insights
 *
 * Shows generated insight for user review before insertion.
 * Allows editing, copying, or cancellation.
 */

import { App, Modal, Setting, MarkdownRenderer, Component } from 'obsidian';
import { ResearchInsightResult, ResearchInsightOptions } from '../types';

export interface InsightAlgorithmOption {
    id: string;
    label: string;
    description: string;
    options: ResearchInsightOptions;
}

export class InsightModal extends Modal {
    private result: ResearchInsightResult;
    private markdownContent: string;
    private onConfirm: (content: string) => void;
    private onCancel: () => void;
    private editMode: boolean = false;
    private editedContent: string;

    constructor(
        app: App,
        result: ResearchInsightResult,
        markdownContent: string,
        onConfirm: (content: string) => void,
        onCancel: () => void
    ) {
        super(app);
        this.result = result;
        this.markdownContent = markdownContent;
        this.editedContent = markdownContent;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('grb-insight-modal');

        // Header
        const headerEl = contentEl.createDiv({ cls: 'grb-modal-header' });
        headerEl.createEl('h2', { text: '🧠 Research Insight Preview' });

        // Stats bar
        const statsEl = headerEl.createDiv({ cls: 'grb-modal-stats' });
        statsEl.createEl('span', { text: `Cost: $${this.result.usage.estimatedCost.toFixed(4)}` });
        statsEl.createEl('span', { text: `•` });
        statsEl.createEl('span', { text: `Time: ${(this.result.processingTime / 1000).toFixed(1)}s` });
        statsEl.createEl('span', { text: `•` });
        statsEl.createEl('span', { text: `Tokens: ${this.result.usage.totalTokens.toLocaleString()}` });

        // Content area
        const contentArea = contentEl.createDiv({ cls: 'grb-modal-content' });

        if (this.editMode) {
            // Edit mode
            const textArea = contentArea.createEl('textarea', {
                cls: 'grb-edit-textarea',
                text: this.editedContent
            });
            textArea.oninput = () => {
                this.editedContent = textArea.value;
            };
        } else {
            // Preview mode
            const previewEl = contentArea.createDiv({ cls: 'grb-preview-content' });

            // Render markdown
            const component = new Component();
            component.load();
            MarkdownRenderer.render(
                this.app,
                this.editedContent,
                previewEl,
                '',
                component
            );
        }

        // Grounding sources (if available)
        if (this.result.grounding && this.result.grounding.sources.length > 0) {
            const groundingEl = contentEl.createDiv({ cls: 'grb-grounding-section' });
            groundingEl.createEl('h4', { text: '🔍 Verification Sources' });
            const sourceList = groundingEl.createEl('ul');
            for (const source of this.result.grounding.sources.slice(0, 5)) {
                const li = sourceList.createEl('li');
                li.createEl('a', {
                    text: source.title,
                    href: source.url,
                    attr: { target: '_blank' }
                });
            }
        }

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'grb-modal-buttons' });

        // Toggle Edit Button
        new Setting(buttonContainer)
            .addButton(btn => btn
                .setButtonText(this.editMode ? 'Preview' : 'Edit')
                .onClick(() => {
                    this.editMode = !this.editMode;
                    this.onOpen();
                })
            )
            .addButton(btn => btn
                .setButtonText('Copy')
                .onClick(() => {
                    navigator.clipboard.writeText(this.editedContent);
                    btn.setButtonText('Copied!');
                    setTimeout(() => btn.setButtonText('Copy'), 1500);
                })
            )
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.onCancel();
                    this.close();
                })
            )
            .addButton(btn => btn
                .setButtonText('Insert')
                .setCta()
                .onClick(() => {
                    this.onConfirm(this.editedContent);
                    this.close();
                })
            );
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Insight Config Modal - Select cognitive algorithm before analysis
 */
export class InsightConfigModal extends Modal {
    private options: InsightAlgorithmOption[];
    private onSubmit: (option: InsightAlgorithmOption) => Promise<void>;
    private onCancel: () => void;
    private selectedId: string;

    constructor(
        app: App,
        options: InsightAlgorithmOption[],
        onSubmit: (option: InsightAlgorithmOption) => Promise<void>,
        onCancel: () => void
    ) {
        super(app);
        this.options = options;
        this.onSubmit = onSubmit;
        this.onCancel = onCancel;
        this.selectedId = options[0]?.id || '';
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('grb-insight-config-modal');

        contentEl.createEl('h2', { text: '🧠 Select Cognitive Algorithm' });
        contentEl.createEl('p', {
            text: 'Choose the analysis mode to run for this note, then submit to start processing.',
            cls: 'setting-item-description'
        });

        if (this.options.length === 0) {
            contentEl.createEl('p', { text: 'No algorithms available. Enable modules in settings.', cls: 'grb-phi-warning-text' });
            const buttonContainer = contentEl.createDiv({ cls: 'grb-modal-buttons' });
            new Setting(buttonContainer)
                .addButton(btn => btn
                    .setButtonText('Close')
                    .setCta()
                    .onClick(() => {
                        this.onCancel();
                        this.close();
                    })
                );
            return;
        }

        const descriptionEl = contentEl.createEl('div', { cls: 'grb-insight-config-desc' });
        descriptionEl.setText(this.options[0].description);

        new Setting(contentEl)
            .setName('Analysis Mode')
            .setDesc('Select a cognitive algorithm')
            .addDropdown(dropdown => dropdown
                .addOptions(this.options.reduce((acc, opt) => {
                    acc[opt.id] = opt.label;
                    return acc;
                }, {} as Record<string, string>))
                .setValue(this.selectedId)
                .onChange(value => {
                    this.selectedId = value;
                    const selected = this.options.find(o => o.id === value);
                    if (selected) {
                        descriptionEl.setText(selected.description);
                    }
                })
            );

        const progressEl = contentEl.createEl('div', { cls: 'grb-insight-config-progress' });
        progressEl.setText('Ready');

        const buttonContainer = contentEl.createDiv({ cls: 'grb-modal-buttons' });
        new Setting(buttonContainer)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.onCancel();
                    this.close();
                })
            )
            .addButton(btn => btn
                .setButtonText('Submit')
                .setCta()
                .onClick(async () => {
                    const selected = this.options.find(o => o.id === this.selectedId);
                    if (!selected) {
                        progressEl.setText('Please select an option.');
                        return;
                    }
                    btn.setDisabled(true);
                    progressEl.setText('Submitting...');
                    try {
                        await this.onSubmit(selected);
                        progressEl.setText('Submitted.');
                        this.close();
                    } catch (error) {
                        progressEl.setText(`Error: ${(error as Error).message}`);
                        btn.setDisabled(false);
                    }
                })
            );
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * PHI Warning Modal - Shows when PHI is detected
 */
export class PHIWarningModal extends Modal {

    private report: string;
    private onDismiss: () => void;
    private violations: any[];
    private onIgnore: () => void;
    private onAutoAnonymize: () => void;
    private onNavigate: (direction: 'prev' | 'next') => void;
    private onSubmit: () => void;

    constructor(app: App, report: string, onDismiss: () => void, options?: {
        violations?: any[],
        onIgnore?: () => void,
        onAutoAnonymize?: () => void,
        onNavigate?: (direction: 'prev' | 'next') => void,
        onSubmit?: () => void
    }) {
        super(app);
        this.report = report;
        this.onDismiss = onDismiss;
        this.violations = options?.violations || [];
        this.onIgnore = options?.onIgnore || (() => {});
        this.onAutoAnonymize = options?.onAutoAnonymize || (() => {});
        this.onNavigate = options?.onNavigate || (() => {});
        this.onSubmit = options?.onSubmit || (() => {});
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('grb-phi-modal');

        // Header
        contentEl.createEl('h2', { text: '🚫 PHI/PII Detected' });

        // Warning message
        contentEl.createEl('p', {
            text: 'Protected Health Information or Personally Identifiable Information was detected in your entry. Processing has been blocked to protect patient privacy.',
            cls: 'grb-phi-warning-text'
        });

        // Report
        const reportEl = contentEl.createEl('pre', {
            cls: 'grb-phi-report'
        });
        reportEl.setText(this.report);

        // Instructions
        contentEl.createEl('h4', { text: 'What to do:' });
        const instructionList = contentEl.createEl('ol');
        instructionList.createEl('li', { text: 'Review the detected violations above' });
        instructionList.createEl('li', { text: 'Remove or anonymize the identified information' });
        instructionList.createEl('li', { text: 'Try generating the insight again' });

        // Navigation and action buttons
        const buttonContainer = contentEl.createDiv({ cls: 'grb-modal-buttons' });
        new Setting(buttonContainer)
            .addButton(btn => btn
                .setButtonText('⬅️ Previous')
                .onClick(() => this.onNavigate('prev'))
            )
            .addButton(btn => btn
                .setButtonText('Next ➡️')
                .onClick(() => this.onNavigate('next'))
            )
            .addButton(btn => btn
                .setButtonText('Ignore')
                .onClick(() => {
                    this.onIgnore();
                    this.close();
                })
            )
            .addButton(btn => btn
                .setButtonText('Auto Anonymize')
                .onClick(() => {
                    this.onAutoAnonymize();
                    this.close();
                })
            )
            .addButton(btn => btn
                .setButtonText('Submit')
                .setCta()
                .onClick(() => {
                    this.onSubmit();
                    this.close();
                })
            );
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Budget Warning Modal - Shows when budget threshold is reached
 */
export class BudgetWarningModal extends Modal {
    private percentage: number;
    private remaining: string;
    private onContinue: () => void;
    private onCancel: () => void;

    constructor(
        app: App,
        percentage: number,
        remaining: string,
        onContinue: () => void,
        onCancel: () => void
    ) {
        super(app);
        this.percentage = percentage;
        this.remaining = remaining;
        this.onContinue = onContinue;
        this.onCancel = onCancel;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('grb-budget-modal');

        // Header
        contentEl.createEl('h2', { text: '⚠️ Budget Warning' });

        // Warning message
        const warningText = this.percentage >= 100
            ? 'Your monthly budget has been exhausted. Processing is disabled until next month.'
            : `You've used ${this.percentage.toFixed(1)}% of your monthly budget.`;

        contentEl.createEl('p', {
            text: warningText,
            cls: 'grb-budget-warning-text'
        });

        contentEl.createEl('p', {
            text: `Remaining: ${this.remaining}`,
            cls: 'grb-budget-remaining'
        });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'grb-modal-buttons' });

        if (this.percentage < 100) {
            new Setting(buttonContainer)
                .addButton(btn => btn
                    .setButtonText('Cancel')
                    .onClick(() => {
                        this.onCancel();
                        this.close();
                    })
                )
                .addButton(btn => btn
                    .setButtonText('Continue Anyway')
                    .setCta()
                    .onClick(() => {
                        this.onContinue();
                        this.close();
                    })
                );
        } else {
            new Setting(buttonContainer)
                .addButton(btn => btn
                    .setButtonText('OK')
                    .setCta()
                    .onClick(() => {
                        this.onCancel();
                        this.close();
                    })
                );
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Loading Modal - Shows during processing
 */
export class LoadingModal extends Modal {
    private message: string;

    constructor(app: App, message: string = 'Generating insight...') {
        super(app);
        this.message = message;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('grb-loading-modal');

        const loadingEl = contentEl.createDiv({ cls: 'grb-loading-container' });

        // Spinner
        loadingEl.createDiv({ cls: 'grb-spinner' });

        // Message
        loadingEl.createEl('p', { text: this.message, cls: 'grb-loading-message' });

        // Tip
        loadingEl.createEl('p', {
            text: 'This may take a few seconds...',
            cls: 'grb-loading-tip'
        });
    }

    updateMessage(message: string): void {
        const messageEl = this.contentEl.querySelector('.grb-loading-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
