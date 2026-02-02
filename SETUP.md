# 🚀 Gemini Research Brain - Setup Instructions

## Quick Start

### 1. Prerequisites
```bash
# Install Node.js 18+ and npm
node --version  # Should be v18 or higher
npm --version
```

### 2. Installation
```bash
# Navigate to project directory
cd gemini-research-brain-complete

# Install dependencies
npm install

# Verify TypeScript compilation
npx tsc --noEmit
```

### 3. Development Build
```bash
# Start watch mode (auto-recompile on changes)
npm run dev

# In another terminal, copy to test vault:
cp -r . /path/to/your/vault/.obsidian/plugins/gemini-research-brain/

# Reload Obsidian (Ctrl+R or Cmd+R)
```

### 4. Configuration
1. Open Obsidian Settings
2. Go to Community Plugins → Gemini Research Brain
3. Enter your Gemini API key from https://aistudio.google.com/apikey
4. Configure budget ($100 default)
5. Enable desired modules

### 5. Testing
Create a test journal entry:
```markdown
Today analyzed WES data for Lynch syndrome cohort.
Found 12 pathogenic variants in MLH1 and MSH2.
Next: Sanger confirmation before ClinVar submission.
```

Click the brain icon 🧬 in the ribbon or use Cmd/Ctrl+P → "Generate Research Insight"

## Project Structure
```
gemini-research-brain/
├── AGENTS.md              # Complete AI agent instructions
├── CLAUDE.md              # Architectural decisions & rationale
├── SETUP.md               # This file
├── src/                   # TypeScript source code
│   ├── main.ts           # Plugin entry point
│   ├── types.ts          # TypeScript interfaces
│   └── core/             # Core services
├── prompts/              # System instruction XML files
├── tests/                # Test files (manual for v1.0)
└── docs/                 # Additional documentation

## Key Files to Read First
1. **AGENTS.md** - Complete development guide for AI coding agents
2. **CLAUDE.md** - Why each decision was made, context from discussion
3. **README.md** - User-facing documentation
4. **src/main.ts** - Plugin entry point

## Development Workflow
1. Read AGENTS.md completely (30 min)
2. Read CLAUDE.md for context (15 min)
3. Implement Phase 1 features (Foundation)
4. Test with 10 sample entries
5. Implement Phase 2 features (Research Intelligence)
6. Test with real use cases
7. Polish UI and documentation
8. Deploy to GitHub

## For AI Coding Agents
This project is designed to be built by AI agents like Claude Code, Cursor, or Windsurf.

**Start here:**
1. Read this SETUP.md
2. Read AGENTS.md thoroughly
3. Read CLAUDE.md for architectural context
4. Begin implementation following Phase 1 → Phase 2 → Phase 3

All necessary context, decisions, and implementation guidance is provided in these documents.

## Support
- Issues: File on GitHub (after repository creation)
- Documentation: See docs/ folder
- Questions: Refer to AGENTS.md troubleshooting section

Good luck building! 🚀
