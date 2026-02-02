/**
 * BackupManager - Insight Backup System
 *
 * Creates and manages backups of generated insights.
 * Compatible with Obsidian Sync.
 */

import { App, TFile, TFolder, Notice } from 'obsidian';
import { BackupManifest, BackupFile } from '../types';

export class BackupManager {
    private app: App;
    private backupFolder: string;

    constructor(app: App, backupFolder: string = '.gemini-research-brain-backups') {
        this.app = app;
        this.backupFolder = backupFolder;
    }

    /**
     * Update backup folder location
     */
    public setBackupFolder(folder: string): void {
        this.backupFolder = folder;
    }

    /**
     * Ensure backup folder exists
     */
    private async ensureBackupFolder(): Promise<void> {
        const folder = this.app.vault.getAbstractFileByPath(this.backupFolder);
        if (!folder) {
            await this.app.vault.createFolder(this.backupFolder);
        }
    }

    /**
     * Create a backup of all notes containing insights
     */
    public async createBackup(): Promise<BackupManifest> {
        await this.ensureBackupFolder();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupSubfolder = `${this.backupFolder}/backup-${timestamp}`;
        await this.app.vault.createFolder(backupSubfolder);

        const files = this.app.vault.getMarkdownFiles();
        const insightFiles: BackupFile[] = [];
        let totalSize = 0;

        for (const file of files) {
            const content = await this.app.vault.read(file);

            // Check if file contains our insight marker
            if (content.includes('## 🧠 Research Insight') || content.includes('Research Insight')) {
                // Copy file to backup folder
                const backupPath = `${backupSubfolder}/${file.path.replace(/\//g, '_')}`;
                await this.app.vault.create(backupPath, content);

                insightFiles.push({
                    path: file.path,
                    size: content.length,
                    modified: new Date(file.stat.mtime).toISOString(),
                });

                totalSize += content.length;
            }
        }

        // Create manifest
        const manifest: BackupManifest = {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            fileCount: insightFiles.length,
            totalSize,
            files: insightFiles,
        };

        // Save manifest
        await this.app.vault.create(
            `${backupSubfolder}/manifest.json`,
            JSON.stringify(manifest, null, 2)
        );

        return manifest;
    }

    /**
     * Backup a single insight
     */
    public async backupInsight(
        notePath: string,
        insightContent: string
    ): Promise<void> {
        await this.ensureBackupFolder();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sanitizedPath = notePath.replace(/\//g, '_').replace('.md', '');
        const backupPath = `${this.backupFolder}/${sanitizedPath}_${timestamp}.md`;

        const backupContent = [
            `# Backup: ${notePath}`,
            `Date: ${new Date().toISOString()}`,
            '',
            '---',
            '',
            insightContent,
        ].join('\n');

        await this.app.vault.create(backupPath, backupContent);
    }

    /**
     * List all backups
     */
    public async listBackups(): Promise<BackupManifest[]> {
        const folder = this.app.vault.getAbstractFileByPath(this.backupFolder);
        if (!folder || !(folder instanceof TFolder)) {
            return [];
        }

        const manifests: BackupManifest[] = [];

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                const manifestPath = `${child.path}/manifest.json`;
                const manifestFile = this.app.vault.getAbstractFileByPath(manifestPath);

                if (manifestFile && manifestFile instanceof TFile) {
                    try {
                        const content = await this.app.vault.read(manifestFile);
                        manifests.push(JSON.parse(content) as BackupManifest);
                    } catch (error) {
                        console.error(`Failed to read manifest: ${manifestPath}`, error);
                    }
                }
            }
        }

        // Sort by timestamp (newest first)
        return manifests.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    /**
     * Restore a backup
     */
    public async restoreBackup(timestamp: string): Promise<number> {
        const backupPath = `${this.backupFolder}/backup-${timestamp.replace(/[:.]/g, '-')}`;
        const folder = this.app.vault.getAbstractFileByPath(backupPath);

        if (!folder || !(folder instanceof TFolder)) {
            throw new Error(`Backup not found: ${timestamp}`);
        }

        let restoredCount = 0;

        for (const child of folder.children) {
            if (child instanceof TFile && child.name !== 'manifest.json') {
                const content = await this.app.vault.read(child);
                const originalPath = child.name.replace(/_/g, '/').replace('.md', '') + '.md';

                // Check if original file exists
                const existingFile = this.app.vault.getAbstractFileByPath(originalPath);
                if (existingFile && existingFile instanceof TFile) {
                    await this.app.vault.modify(existingFile, content);
                } else {
                    // Create missing directories if needed
                    const dirs = originalPath.split('/').slice(0, -1);
                    let currentPath = '';
                    for (const dir of dirs) {
                        currentPath += (currentPath ? '/' : '') + dir;
                        const dirExists = this.app.vault.getAbstractFileByPath(currentPath);
                        if (!dirExists) {
                            await this.app.vault.createFolder(currentPath);
                        }
                    }
                    await this.app.vault.create(originalPath, content);
                }

                restoredCount++;
            }
        }

        return restoredCount;
    }

    /**
     * Delete old backups (keep last N)
     */
    public async cleanupOldBackups(keepCount: number = 5): Promise<number> {
        const backups = await this.listBackups();
        let deletedCount = 0;

        if (backups.length <= keepCount) {
            return 0;
        }

        const toDelete = backups.slice(keepCount);

        for (const backup of toDelete) {
            const backupPath = `${this.backupFolder}/backup-${backup.timestamp.replace(/[:.]/g, '-')}`;
            const folder = this.app.vault.getAbstractFileByPath(backupPath);

            if (folder && folder instanceof TFolder) {
                // Delete all files in folder
                for (const child of folder.children) {
                    if (child instanceof TFile) {
                        await this.app.vault.delete(child);
                    }
                }
                // Delete folder
                await this.app.vault.delete(folder);
                deletedCount++;
            }
        }

        return deletedCount;
    }

    /**
     * Get backup statistics
     */
    public async getBackupStats(): Promise<{
        totalBackups: number;
        totalSize: number;
        oldestBackup: string | null;
        newestBackup: string | null;
    }> {
        const backups = await this.listBackups();

        if (backups.length === 0) {
            return {
                totalBackups: 0,
                totalSize: 0,
                oldestBackup: null,
                newestBackup: null,
            };
        }

        const totalSize = backups.reduce((sum, b) => sum + b.totalSize, 0);

        return {
            totalBackups: backups.length,
            totalSize,
            oldestBackup: backups[backups.length - 1].timestamp,
            newestBackup: backups[0].timestamp,
        };
    }
}
