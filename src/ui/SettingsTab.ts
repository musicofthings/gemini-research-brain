/**
 * SettingsTab - Plugin Settings Interface
 *
 * Tabbed settings UI with:
 * - API Configuration
 * - Feature Toggles
 * - Cost Dashboard
 * - Backup Options
 * - Advanced Settings
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type GeminiResearchBrainPlugin from '../main';
import { GeminiResearchBrainSettings, DEFAULT_SETTINGS, GeminiModel, ThinkingLevel } from '../types';

export class GeminiResearchBrainSettingsTab extends PluginSettingTab {
    plugin: GeminiResearchBrainPlugin;
    private activeTab: string = 'api';

    constructor(app: App, plugin: GeminiResearchBrainPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Header
        containerEl.createEl('h1', { text: '🧠 Gemini Research Brain' });
        containerEl.createEl('p', {
            text: 'AI-powered research journaling for physician-scientists',
            cls: 'setting-item-description'
        });

        // Cost Dashboard (always visible at top)
        this.renderCostDashboard(containerEl);

        // Tab Navigation
        const tabContainer = containerEl.createDiv({ cls: 'grb-tab-container' });
        const tabs = [
            { id: 'api', label: '🔑 API', icon: 'key' },
            { id: 'features', label: '⚡ Features', icon: 'zap' },
            { id: 'modules', label: '🧩 Modules', icon: 'puzzle' },
            { id: 'backup', label: '💾 Backup', icon: 'save' },
            { id: 'advanced', label: '⚙️ Advanced', icon: 'settings' },
        ];

        const tabNav = tabContainer.createDiv({ cls: 'grb-tab-nav' });
        for (const tab of tabs) {
            const tabBtn = tabNav.createEl('button', {
                text: tab.label,
                cls: `grb-tab-btn ${this.activeTab === tab.id ? 'active' : ''}`
            });
            tabBtn.onclick = () => {
                this.activeTab = tab.id;
                this.display();
            };
        }

        // Tab Content
        const tabContent = tabContainer.createDiv({ cls: 'grb-tab-content' });

        switch (this.activeTab) {
            case 'api':
                this.renderAPITab(tabContent);
                break;
            case 'features':
                this.renderFeaturesTab(tabContent);
                break;
            case 'modules':
                this.renderModulesTab(tabContent);
                break;
            case 'backup':
                this.renderBackupTab(tabContent);
                break;
            case 'advanced':
                this.renderAdvancedTab(tabContent);
                break;
        }
    }

    /**
     * Render the cost dashboard
     */
    private renderCostDashboard(containerEl: HTMLElement): void {
        const dashboardEl = containerEl.createDiv({ cls: 'grb-cost-dashboard' });
        dashboardEl.createEl('h3', { text: '💰 Budget Status' });

        const stats = this.plugin.costTracker.getFormattedStats();
        const percentage = this.plugin.costTracker.getBudgetUsagePercentage();

        // Progress bar
        const progressContainer = dashboardEl.createDiv({ cls: 'grb-progress-container' });
        const progressBar = progressContainer.createDiv({ cls: 'grb-progress-bar' });
        const progressFill = progressBar.createDiv({
            cls: `grb-progress-fill ${percentage >= 80 ? 'warning' : ''} ${percentage >= 100 ? 'danger' : ''}`
        });
        progressFill.style.width = `${Math.min(percentage, 100)}%`;

        // Stats grid
        const statsGrid = dashboardEl.createDiv({ cls: 'grb-stats-grid' });

        this.createStatCard(statsGrid, 'Spent', stats.spent, `of $${this.plugin.settings.monthlyBudget}`);
        this.createStatCard(statsGrid, 'Remaining', stats.remaining, '');
        this.createStatCard(statsGrid, 'Requests', stats.requests.toString(), 'this month');
        this.createStatCard(statsGrid, 'Projected', stats.projected, '/month');

        // Warning if over threshold
        if (percentage >= this.plugin.settings.budgetAlertThreshold) {
            const warningEl = dashboardEl.createDiv({ cls: 'grb-budget-warning' });
            warningEl.createEl('span', { text: `⚠️ Budget usage at ${stats.percentage}` });
        }
    }

    private createStatCard(container: HTMLElement, label: string, value: string, subtitle: string): void {
        const card = container.createDiv({ cls: 'grb-stat-card' });
        card.createEl('div', { text: label, cls: 'grb-stat-label' });
        card.createEl('div', { text: value, cls: 'grb-stat-value' });
        if (subtitle) {
            card.createEl('div', { text: subtitle, cls: 'grb-stat-subtitle' });
        }
    }

    /**
     * API Configuration Tab
     */
    private renderAPITab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'API Configuration' });

        // API Key
        new Setting(containerEl)
            .setName('Gemini API Key')
            .setDesc('Get your API key from Google AI Studio')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                })
                .inputEl.type = 'password'
            );

        // Test Connection Button
        new Setting(containerEl)
            .setName('Test Connection')
            .setDesc('Verify your API key is working')
            .addButton(btn => btn
                .setButtonText('Test')
                .onClick(async () => {
                    btn.setButtonText('Testing...');
                    btn.setDisabled(true);
                    const result = await this.plugin.geminiProvider.testConnection();
                    new Notice(result.message);
                    btn.setButtonText('Test');
                    btn.setDisabled(false);
                })
            );

        // Model Selection
        new Setting(containerEl)
            .setName('Model')
            .setDesc('Select the Gemini model to use')
            .addDropdown(dropdown => dropdown
                .addOption('gemini-3-pro-preview', 'Gemini 3 Pro Preview')
                .addOption('gemini-3-flash-preview', 'Gemini 3 Flash Preview')
                .addOption('gemini-flash-latest', 'Gemini Flash (Latest)')
                .addOption('gemini-flash-lite-latest', 'Gemini Flash Lite (Latest)')
                .setValue(this.plugin.settings.model)
                .onChange(async (value: GeminiModel) => {
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                })
            );

        // Temperature
        new Setting(containerEl)
            .setName('Temperature')
            .setDesc('Controls randomness (1.0 recommended for Gemini)')
            .addSlider(slider => slider
                .setLimits(0, 2, 0.1)
                .setValue(this.plugin.settings.temperature)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.temperature = value;
                    await this.plugin.saveSettings();
                })
            );

        // Max Output Tokens
        new Setting(containerEl)
            .setName('Max Output Tokens')
            .setDesc('Maximum length of generated responses')
            .addSlider(slider => slider
                .setLimits(1024, 16384, 1024)
                .setValue(this.plugin.settings.maxOutputTokens)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxOutputTokens = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * Features Tab
     */
    private renderFeaturesTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Feature Settings' });


        // Thinking Level
        new Setting(containerEl)
            .setName('Thinking Level')
            .setDesc('Low: faster, cheaper. High: more thorough analysis.')
            .addDropdown(dropdown => dropdown
                .addOption('low', 'Low (Faster)')
                .addOption('high', 'High (Thorough)')
                .setValue(this.plugin.settings.thinkingLevel)
                .onChange(async (value: ThinkingLevel) => {
                    this.plugin.settings.thinkingLevel = value;
                    await this.plugin.saveSettings();
                })
            );

        // Auto-detect Thinking Level
        new Setting(containerEl)
            .setName('Auto-detect Thinking Level')
            .setDesc('Automatically use high thinking for complex content')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoDetectThinkingLevel)
                .onChange(async (value) => {
                    this.plugin.settings.autoDetectThinkingLevel = value;
                    await this.plugin.saveSettings();
                })
            );

        // Voice Dictation Toggle
        new Setting(containerEl)
            .setName('🎤 Voice Dictation')
            .setDesc('Enable or disable voice dictation features (mic button, transcription)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableVoiceDictation)
                .onChange(async (value) => {
                    this.plugin.settings.enableVoiceDictation = value;
                    await this.plugin.saveSettings();
                })
            );

        // Show Preview Modal
        new Setting(containerEl)
            .setName('Show Preview Modal')
            .setDesc('Preview insights before inserting into note')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showPreviewModal)
                .onChange(async (value) => {
                    this.plugin.settings.showPreviewModal = value;
                    await this.plugin.saveSettings();
                })
            );

        // Budget Settings
        containerEl.createEl('h4', { text: 'Budget Settings' });

        new Setting(containerEl)
            .setName('Monthly Budget')
            .setDesc('Maximum monthly spending limit (USD)')
            .addText(text => text
                .setPlaceholder('100')
                .setValue(this.plugin.settings.monthlyBudget.toString())
                .onChange(async (value) => {
                    const budget = parseFloat(value) || 100;
                    this.plugin.settings.monthlyBudget = budget;
                    this.plugin.costTracker.updateBudget(budget, this.plugin.settings.budgetAlertThreshold);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Budget Alert Threshold')
            .setDesc('Show warning at this percentage of budget used')
            .addSlider(slider => slider
                .setLimits(50, 100, 5)
                .setValue(this.plugin.settings.budgetAlertThreshold)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.budgetAlertThreshold = value;
                    this.plugin.costTracker.updateBudget(this.plugin.settings.monthlyBudget, value);
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * Modules Tab
     */
    private renderModulesTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Analysis Modules' });

        containerEl.createEl('p', {
            text: 'Enable or disable specific analysis modules. Inverted Pyramid is always enabled.',
            cls: 'setting-item-description'
        });

        // Inverted Pyramid (always enabled)
        new Setting(containerEl)
            .setName('📝 Inverted Pyramid Summary')
            .setDesc('3-sentence executive summary (Lead → Body → Tail). Always enabled.')
            .addToggle(toggle => toggle
                .setValue(true)
                .setDisabled(true)
            );

        // Google Search Grounding
        new Setting(containerEl)
            .setName('🔍 Google Search Grounding')
            .setDesc('Verify clinical claims against web sources')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableGrounding)
                .onChange(async (value) => {
                    this.plugin.settings.enableGrounding = value;
                    await this.plugin.saveSettings();
                })
            );

        // PubMed Integration
        new Setting(containerEl)
            .setName('📚 PubMed Integration')
            .setDesc('Search for relevant literature citations')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enablePubMed)
                .onChange(async (value) => {
                    this.plugin.settings.enablePubMed = value;
                    await this.plugin.saveSettings();
                })
            );

        // Code Audit
        new Setting(containerEl)
            .setName('💻 Code Auditor')
            .setDesc('Review code blocks for issues (Nextflow, Python, Bash, R)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableCodeAudit)
                .onChange(async (value) => {
                    this.plugin.settings.enableCodeAudit = value;
                    await this.plugin.saveSettings();
                })
            );

        // Frame Analysis
        new Setting(containerEl)
            .setName('🖼️ Frame Analysis')
            .setDesc('Detect cognitive biases and framing effects')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFrameAnalysis)
                .onChange(async (value) => {
                    this.plugin.settings.enableFrameAnalysis = value;
                    await this.plugin.saveSettings();
                })
            );

        // Vault Connector
        new Setting(containerEl)
            .setName('🔗 Vault Connector')
            .setDesc('Suggest links to related notes in your vault')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableVaultConnector)
                .onChange(async (value) => {
                    this.plugin.settings.enableVaultConnector = value;
                    await this.plugin.saveSettings();
                })
            );

        // 5-Whys
        new Setting(containerEl)
            .setName('❓ 5-Whys Analysis')
            .setDesc('Root cause analysis for problems and blockers')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFiveWhys)
                .onChange(async (value) => {
                    this.plugin.settings.enableFiveWhys = value;
                    await this.plugin.saveSettings();
                })
            );

        // Shadow Prompt
        new Setting(containerEl)
            .setName('👻 Shadow Prompt')
            .setDesc('Surface omissions via provocative questions')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableShadowPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.enableShadowPrompt = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * Backup Tab
     */
    private renderBackupTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Backup Settings' });

        // Auto Backup
        new Setting(containerEl)
            .setName('Auto Backup')
            .setDesc('Automatically backup insights after generation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutoBackup)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutoBackup = value;
                    await this.plugin.saveSettings();
                })
            );

        // Backup Location
        new Setting(containerEl)
            .setName('Backup Folder')
            .setDesc('Folder path for storing backups (relative to vault)')
            .addText(text => text
                .setPlaceholder('.gemini-research-brain-backups')
                .setValue(this.plugin.settings.backupLocation)
                .onChange(async (value) => {
                    this.plugin.settings.backupLocation = value || DEFAULT_SETTINGS.backupLocation;
                    await this.plugin.saveSettings();
                })
            );

        // Manual Backup Button
        new Setting(containerEl)
            .setName('Create Backup')
            .setDesc('Manually create a backup of all insights')
            .addButton(btn => btn
                .setButtonText('Backup Now')
                .onClick(async () => {
                    btn.setButtonText('Creating...');
                    btn.setDisabled(true);
                    try {
                        await this.plugin.backupManager.createBackup();
                        new Notice('✅ Backup created successfully!');
                    } catch (error) {
                        new Notice(`❌ Backup failed: ${(error as Error).message}`);
                    }
                    btn.setButtonText('Backup Now');
                    btn.setDisabled(false);
                })
            );
    }

    /**
     * Advanced Tab
     */
    private renderAdvancedTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Advanced Settings' });

        // Debug Mode
        new Setting(containerEl)
            .setName('Debug Mode')
            .setDesc('Enable verbose logging to console')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                })
            );

        // Auto Insert on Mobile
        new Setting(containerEl)
            .setName('Auto Insert on Mobile')
            .setDesc('Skip preview modal on mobile devices')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoInsertOnMobile)
                .onChange(async (value) => {
                    this.plugin.settings.autoInsertOnMobile = value;
                    await this.plugin.saveSettings();
                })
            );

        // Reset Cost Stats
        containerEl.createEl('h4', { text: 'Data Management' });

        new Setting(containerEl)
            .setName('Reset Cost Statistics')
            .setDesc('Clear all usage data (cannot be undone)')
            .addButton(btn => btn
                .setButtonText('Reset')
                .setWarning()
                .onClick(async () => {
                    this.plugin.costTracker.reset();
                    new Notice('✅ Cost statistics reset');
                    this.display();
                })
            );

        // Reset Settings
        new Setting(containerEl)
            .setName('Reset All Settings')
            .setDesc('Restore all settings to default values')
            .addButton(btn => btn
                .setButtonText('Reset')
                .setWarning()
                .onClick(async () => {
                    this.plugin.settings = { ...DEFAULT_SETTINGS };
                    await this.plugin.saveSettings();
                    new Notice('✅ Settings reset to defaults');
                    this.display();
                })
            );

        // Version Info
        containerEl.createEl('h4', { text: 'About' });
        const aboutEl = containerEl.createDiv({ cls: 'grb-about' });
        aboutEl.createEl('p', { text: `Version: ${this.plugin.manifest.version}` });
        aboutEl.createEl('p', { text: 'Author: Shibi' });
        aboutEl.createEl('p', {
            text: 'An AI-powered research journaling tool for physician-scientists.',
            cls: 'setting-item-description'
        });
    }
}
