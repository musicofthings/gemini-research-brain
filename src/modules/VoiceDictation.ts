import { Plugin, Notice, requestUrl } from 'obsidian';
// If using willow or wispr, import here
// import Willow from 'willow-sdk';

export class VoiceDictation {
    private plugin: Plugin;
    private geminiApiKey: string;
    private geminiModel: string;
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private mediaStream: MediaStream | null = null;

    constructor(plugin: Plugin, geminiApiKey: string, geminiModel: string) {
        this.plugin = plugin;
        this.geminiApiKey = geminiApiKey;
        this.geminiModel = geminiModel;
    }

    async startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            new Notice('🎤 Voice recording not supported in this browser.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaStream = stream;
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            this.mediaRecorder.start();
            new Notice('🎙️ Recording started...');
        } catch (err) {
            new Notice('🎤 Could not start recording: ' + err);
        }
    }

    stopRecording(): Promise<Blob | null> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                new Notice('🎤 No recording in progress.');
                resolve(null);
                return;
            }
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                if (this.mediaStream) {
                    this.mediaStream.getTracks().forEach(track => track.stop());
                    this.mediaStream = null;
                }
                new Notice('🛑 Recording stopped.');
                resolve(audioBlob);
            };
            this.mediaRecorder.stop();
        });
    }

    async transcribeAudio(audioBlob: Blob): Promise<string> {
        // Use Google Cloud Speech-to-Text API (CORS-safe via requestUrl)
        const endpoint = `https://speech.googleapis.com/v1/speech:recognize?key=${this.geminiApiKey}`;
        try {
            // Convert audioBlob to base64 for requestUrl (since multipart/form-data is not supported)
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = this.arrayBufferToBase64(arrayBuffer);
            const body = JSON.stringify({
                config: {
                    encoding: 'WEBM_OPUS',
                    sampleRateHertz: 48000,
                    languageCode: 'en-US',
                    enableAutomaticPunctuation: true
                },
                audio: {
                    content: base64Audio
                }
            });
            const response = await requestUrl({
                url: endpoint,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });
            if (response.status !== 200) {
                throw new Error(`Transcription request failed (${response.status}): ${response.text || 'Unknown error'}`);
            }
            const data = response.json as any;
            const transcript = (data?.results || [])
                .map((r: any) => r?.alternatives?.[0]?.transcript)
                .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
                .join('\n');
            if (!transcript) {
                new Notice('📝 Transcription returned no text. Try a shorter recording.');
            }
            if ((this.plugin as any)?.settings?.debugMode) {
                console.error('Transcription raw response:', data);
                console.error('Transcription text length:', transcript.length);
            }
            return transcript || '';
        } catch (err) {
            new Notice('📝 Transcription error: ' + err);
            return '';
        }
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;
        let binary = '';
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
    }
}
