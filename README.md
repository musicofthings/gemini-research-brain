# 🧠 Gemini Research Brain

AI-powered research journaling for physician-scientists and clinical researchers.

---

## ✅ Core Features

- Voice-to-text dictation with a ribbon mic button and hotkey
- Research insights with Inverted Pyramid summaries
- PHI/PII detection with review workflow, auto-anonymize, and ignore override
- Cost tracking and budget enforcement
- Google Search grounding, PubMed integration, and code audit (optional)
- Configurable cognitive algorithms before analysis

---

## 🚀 Install (Obsidian)

Copy these files/folders into your vault at .obsidian/plugins/gemini-research-brain:

- [main.js](main.js)
- [manifest.json](manifest.json)
- [styles.css](styles.css)
- [README.md](README.md)
- [prompts/](prompts/)

Then reload Obsidian and enable the plugin.

---

## 🎤 Voice Dictation

- Use the ribbon mic button to start/stop dictation.
- Default hotkey: Mod + Shift + D
- The transcript is inserted at the cursor in the active note.

**Requirement:** Enable the Google Cloud Speech-to-Text API in the same project as your API key.

Tip: Change the hotkey in Settings → Hotkeys → Start/Stop Voice Dictation.

---

## 🧠 Research Insight Workflow

Click the brain ribbon icon to open a pre-analysis modal:

1. Select a cognitive algorithm (dropdown)
2. Click Submit
3. The analysis runs and inserts output according to your selection

The output format includes a 3-sentence Inverted Pyramid summary:

- Lead (main insight)
- Body (context)
- Tail (implications)

---

## 🧪 PHI/PII Review Tools

If PHI/PII is detected, the plugin blocks processing and opens a review modal.

You can:
- Use arrow keys to jump between detected phrases
- Edit content directly in the note
- Submit to re-check
- Auto-anonymize to redact all detected phrases
- Ignore to proceed without blocking

---

## 🔧 Models Supported

- Gemini 3.0 Pro
- Gemini 3.0 Flash
- Gemini 2.0 Pro
- Gemini 2.0 Flash
- Gemini 2.0 Flash Thinking (Experimental)
- Gemini 1.5 Pro
- Gemini 1.5 Flash

---

## ⚙️ Settings Overview

- API key, model selection, temperature, max output tokens
- Feature toggles and module controls
- Cost tracking and budget limits
- Backup folder configuration
- Voice dictation enable/disable

---

## 🛟 Troubleshooting

- CORS errors: all API calls use Obsidian requestUrl
- Rate limit exceeded: wait a few minutes and retry
- Hotkey not detected: reload Obsidian and ensure the editor is focused
- PHI false positives: use Ignore or Auto-anonymize, or edit and Submit

---

## 📜 License

MIT
✅ No data retention except user's notes

### Security Audits
- No eval() or unsafe code execution
- Input validation on all settings
- Secure API key storage
- HTTPS-only API calls

---

## 🧪 Testing

### Manual Tests (v1.0)
1. Simple entry (no PHI, no code) → 3-sentence summary
2. Clinical entry (p-values, genes) → Grounding + PubMed
3. Code entry (Nextflow) → Code audit with fixes
4. PHI entry (MRN: 123456) → Blocked with error

### Automated Tests (v1.1 roadmap)
- Jest unit tests
- Integration tests
- E2E with Playwright

---

## 🗺️ Roadmap

### v1.0 (Current) - Foundation
- All Phase 1 + 2 + 3 features
- Manual testing
- Community plugin submission

### v1.1 (Q2 2026) - Enhancements
- Gamma AI export
- Google Drive backup
- Automated testing
- Custom system prompts

### v1.2 (Q3 2026) - Collaboration
- Canvas integration
- Voice note transcription
- Shared insights

### v2.0 (Q4 2026) - Advanced
- Local LLM support (Ollama)
- Grant writing assistant
- Research trend detection

---

## 👥 Target Users

### Primary Audience
- Physician-scientists
- Clinical researchers
- Bioinformaticians
- Genomics analysts
- Trial coordinators

### Use Cases
- Daily research journaling
- Clinical trial documentation
- Literature synthesis
- Code review (pipelines)
- Grant proposal notes

---

## 🤝 Contributing

### For AI Agents
This project is designed to be built by AI coding agents:
- Read AGENTS.md for complete instructions
- Follow phase-by-phase implementation
- Test thoroughly before moving to next phase

### For Human Developers
1. Fork repository (after creation)
2. Create feature branch
3. Follow coding standards in AGENTS.md
4. Test with manual integration tests
5. Submit pull request

---

## 📞 Support

### Documentation
- Full guide: `AGENTS.md` (for builders)
- User guide: Will be in deployed plugin README
- API docs: Inline TypeScript comments

### Issues
- File on GitHub (after repository creation)
- Check AGENTS.md troubleshooting first
- Include: OS, Obsidian version, error logs

### Community
- Obsidian forum: [To be created]
- Discord: [To be created]
- GitHub Discussions: [To be created]

---

## 📄 License

MIT License - See LICENSE file

Free to use, modify, and distribute with attribution.

---

## 🙏 Acknowledgments

- Built for the physician-scientist community
- Powered by Gemini 3 Pro (Google DeepMind)
- PubMed integration via MCP protocol
- Inspired by "Building a Second Brain" (Tiago Forte)
- Designed through collaboration with Claude (Anthropic)

---

## 🎯 Success Metrics

### Technical
- ✅ 95%+ API success rate
- ✅ <5s insight generation
- ✅ Zero PHI leaks
- ✅ <10 critical bugs/month

### User
- ✅ 100+ downloads (month 1)
- ✅ 50+ weekly active users (month 3)
- ✅ 4.0+ star rating
- ✅ Featured in Obsidian roundup

---

## 🚀 Get Started Now

### For AI Agents (Claude Code, Cursor, Windsurf)
```bash
# 1. Open project
cd gemini-research-brain-complete

# 2. Read instructions
cat AGENTS.md

# 3. Start building
# Follow Phase 1 → Phase 2 → Phase 3
```

### For Human Developers
```bash
# 1. Review documentation
less SETUP.md
less AGENTS.md

# 2. Install dependencies
npm install

# 3. Start development
npm run dev
```

### For End Users
This is a **source code package** for developers.

If you're a researcher looking to **use** this plugin:
- Wait for community plugin release
- Or contact developer for beta access

---

**Built with ❤️ for researchers who code and developers who research.**

**Ready to build? Open `AGENTS.md` and start with Phase 1! 🧬**

---

# Gemini Research Brain Plugin

## Overview
Gemini Research Brain is an Obsidian plugin for physician-scientists and clinical researchers. It enables:
- **Voice-to-text dictation** for daily journaling (create new notes or add to existing ones)
- **AI-powered research insights** (executive summaries, clinical verification, code audit, and more)

## Features
- 🎤 **Dictation**: Record your voice, transcribe using Gemini API, and insert text into notes
- 🧠 **Research Insights**: Summarize entries, verify claims, audit code, and more
- 🔒 **PHI/PII Sanitizer**: HIPAA-compliant content filtering
- 💸 **Cost Tracking**: Monitor Gemini API usage and budget
- 🔗 **PubMed & Google Search**: Clinical claim verification

## Getting Started
1. **Install the plugin**
   - Copy `main.js`, `manifest.json`, `styles.css`, and the `prompts/` folder to your vault’s `.obsidian/plugins/gemini-research-brain/` directory.
2. **Enable the plugin** in Obsidian settings (Community Plugins).
3. **Configure your Gemini API key** in the plugin settings tab.

## Using Voice Dictation
- Open the plugin’s command palette or settings tab.
- Click **Start Dictation** to begin recording.
- Click **Stop Dictation** to end recording and transcribe.
- The transcribed text will be inserted into your daily note or a selected note.

## Using Research Insights
- Add or select a journal entry in your note.
- Use the **Generate Research Insight** command.
- The plugin will summarize your entry and add Lead, Context, and Implications.

## Troubleshooting
- **Rate limit errors**: Wait a few minutes and try again. Check your Gemini API quota.
- **PHI detected**: Remove patient identifiers before submitting.
- **Debug mode**: Enable in Advanced Settings to see logs in the Developer Console.

## Dependencies
- Uses Gemini API for both dictation and insights
- May use [Willow](https://github.com/willow-voice/willow) or [Wispr Flow](https://github.com/wispr-ai/wispr-flow) for advanced audio capture (optional)

## Roadmap
- Mobile compatibility
- Cloud backup (Google Drive)
- More cognitive modules

## License
MIT
