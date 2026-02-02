# 🤖 AGENTS.md - AI Development Agent Instructions

This document provides comprehensive instructions for AI coding agents (Claude Code, Cursor, Windsurf, etc.) to develop and maintain the Gemini Research Brain plugin.

---

## 📋 Project Overview

**Project Name:** Gemini Research Brain  
**Type:** Obsidian Plugin  
**Target Users:** Physician-scientists, clinical researchers, bioinformaticians  
**Primary Use Case:** AI-powered research journaling with clinical verification and literature integration

---

## 🎯 Core Product Features

### Phase 1: Foundation (MUST IMPLEMENT FIRST)
1. **Inverted Pyramid Analysis**
   - Distill journal entries into 3-sentence executive summaries
   - Structure: Lead (main insight) → Body (context) → Tail (implications)
   - Always enabled, cannot be disabled

2. **PHI/PII Sanitizer**
   - HIPAA-compliant content filtering
   - Block processing if patient identifiers detected
   - Patterns: MRNs, SSNs, DOBs, patient names, phone numbers
   - Must run BEFORE any API calls

3. **Cost Tracking System**
   - Real-time token usage monitoring
   - Monthly budget enforcement ($100 default)
   - Alert at 80% budget threshold
   - Track: input tokens, output tokens, thinking tokens separately
   - Persist to localStorage with monthly auto-reset

4. **Gemini API Integration**
   - Model: gemini-3-pro-preview
   - Support thinking_level: "low" | "high"
   - Temperature: 1.0 (optimal for Gemini 3 Pro)
   - Retry logic: 3 attempts with exponential backoff
   - Use Obsidian's requestUrl for CORS compatibility

### Phase 2: Research Intelligence (IMPLEMENT AFTER PHASE 1 WORKS)
1. **Google Search Grounding**
   - Real-time clinical claim verification
   - Activate when medical terminology detected
   - dynamicThreshold: 0.75 (only ground uncertain claims)
   - Parse groundingChunks for source URLs

2. **PubMed MCP Integration**
   - Use PubMed:search_articles tool
   - Optimize queries: genes + diseases + methods + date range
   - Fetch top 5 articles via get_article_metadata
   - Display: Title, Authors, PMID, DOI, relevance note

3. **Code Auditor**
   - Support: Nextflow, Python, Bash, R, WDL
   - Check: syntax errors, logic bugs, resource allocation
   - Bioinformatics-specific: VCF parsing, reference genome builds, tool versions
   - Output: Critical issues, Warnings, Optimizations, Checklist

### Phase 3: Cognitive Modules (OPTIONAL ENHANCEMENTS)
1. **Frame Analysis** - Detect cognitive biases (Media Frame Theory)
2. **Vault Connector** - Suggest links to related notes (cloud inference)
3. **5-Whys Analysis** - Root cause analysis for blockers
4. **Shadow Prompt** - Surface omissions via provocative questions

### Cross-Cutting Features
1. **Backup System**
   - Compatible with Obsidian Sync (primary)
   - Google Drive support (v1.1 roadmap)
   - Backup manifest: timestamp, file count, total size
   - Auto-backup after each insight generation

2. **Mobile Compatibility**
   - Must work on iOS and Android Obsidian apps
   - Test with reduced thinking level on mobile
   - Optimize for slower network conditions

3. **Settings UI**
   - Tabbed interface: API Config, Features, Modules, Cost, Backup, Advanced
   - Real-time cost dashboard with projections
   - Per-module toggles (except Inverted Pyramid)
   - Budget alert slider (50-100%)

---

## 🏗️ Architecture Principles

### 1. Cloud-Native Design
- **No local processing** except Obsidian note storage
- All AI analysis happens via Gemini API
- Vault Connector uses cloud inference (no direct filesystem access)
- Backups leverage Obsidian Sync or external cloud storage

### 2. Safety-First Approach
- PHI sanitizer MUST run before every API call
- If PHI detected: throw error, do NOT process
- Never log user content to console
- API keys stored in Obsidian's secure data.json

### 3. Cost-Conscious Processing
- Auto-detect thinking level based on content complexity
- Default to "high" only when: clinical claims + code blocks + 500+ words
- Track all token types separately (input, output, thinking)
- Enforce hard budget limits (block processing at 100%)

### 4. Progressive Enhancement
- Start with minimal viable features (Phase 1)
- Add complexity only after core works flawlessly
- Each phase must be independently testable
- Never ship untested features

---

## 📁 File Structure Reference

```
gemini-research-brain/
├── src/
│   ├── main.ts                      # Plugin entry point, command registration
│   ├── types.ts                     # TypeScript interfaces for entire project
│   ├── core/
│   │   ├── GeminiProvider.ts        # Main API orchestrator, handles all Gemini calls
│   │   ├── SanitizerEngine.ts       # PHI/PII detection, must block dangerous content
│   │   ├── CostTracker.ts           # Token usage tracking, budget enforcement
│   │   └── PubMedConnector.ts       # PubMed MCP integration
│   ├── modules/
│   │   ├── InvertedPyramid.ts       # Core summarization (always active)
│   │   ├── SearchGrounding.ts       # Google Search verification
│   │   ├── CodeAuditor.ts           # Code review logic
│   │   ├── FrameAnalyzer.ts         # Bias detection
│   │   ├── VaultConnector.ts        # Link suggestions
│   │   └── FiveWhys.ts              # Root cause analysis
│   ├── ui/
│   │   ├── SettingsTab.ts           # Plugin settings interface
│   │   ├── InsightModal.ts          # Preview modal before insertion
│   │   └── CostDashboard.ts         # Real-time usage visualization
│   └── utils/
│       ├── BackupManager.ts         # Handles backup creation and restoration
│       └── XMLParser.ts             # Parse structured responses from Gemini
├── prompts/
│   ├── system-instruction.xml       # Base cognitive frameworks
│   ├── medical-research-mode.xml    # Clinical verification instructions
│   └── code-auditor-mode.xml        # Pipeline analysis instructions
├── tests/
│   ├── integration/
│   │   ├── complete-workflow.test.ts
│   │   ├── grounding.test.ts
│   │   ├── pubmed.test.ts
│   │   └── sanitizer.test.ts
│   └── fixtures/
│       ├── sample-entries/          # Test journal entries (anonymized)
│       └── code-snippets/           # Nextflow/Python test cases
├── manifest.json                    # Obsidian plugin metadata
├── package.json                     # npm dependencies
├── tsconfig.json                    # TypeScript configuration
├── esbuild.config.mjs               # Build configuration
├── styles.css                       # UI styling
└── README.md                        # User documentation
```

---

## 🔧 Development Workflow

### Initial Setup
```bash
# 1. Install dependencies
npm install

# 2. Verify TypeScript compilation
npx tsc --noEmit

# 3. Start development build
npm run dev

# 4. Copy to test vault
cp -r . /path/to/test-vault/.obsidian/plugins/gemini-research-brain/
```

### Development Cycle
1. **Make changes** to TypeScript source files
2. **esbuild watches** and auto-compiles to main.js
3. **Reload Obsidian** (Ctrl+R or Cmd+R) to test
4. **Check console** for errors (Ctrl+Shift+I / Cmd+Opt+I)
5. **Iterate** until feature works

### Testing Checklist (Before Each Commit)
```markdown
- [ ] TypeScript compiles without errors
- [ ] Plugin loads in Obsidian
- [ ] Settings tab renders correctly
- [ ] Test with sample entry (no PHI)
- [ ] Test with PHI entry (should block)
- [ ] Verify cost tracking updates
- [ ] Check console for errors
- [ ] Test on mobile (if UI changes)
```

---

## 🎨 Coding Standards

### TypeScript
```typescript
// GOOD: Explicit types, error handling
async function generateInsight(
    entry: string,
    options: ResearchInsightOptions
): Promise<ResearchInsightResult> {
    try {
        const analysis = await this.analyzeContent(entry);
        if (analysis.containsPHI) {
            throw new Error('PHI detected');
        }
        // ... rest of logic
    } catch (error) {
        console.error('Insight generation failed:', error);
        throw error;
    }
}

// BAD: Any types, no error handling
async function generateInsight(entry: any, options: any): Promise<any> {
    const analysis = await this.analyzeContent(entry);
    // What if this throws?
}
```

### Obsidian API Usage
```typescript
// GOOD: Use requestUrl for API calls
const response = await requestUrl({
    url: apiUrl,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
});

// BAD: Direct fetch (CORS issues)
const response = await fetch(apiUrl, { ... });
```

### Error Messages
```typescript
// GOOD: Actionable error messages
throw new Error('⚠️ Gemini API key missing. Configure in Settings → Gemini Research Brain → API Configuration');

// BAD: Vague errors
throw new Error('API error');
```

### UI Feedback
```typescript
// GOOD: Clear, non-technical notices
new Notice('✅ Research insight added to note!');
new Notice('⚠️ You've used 85% of your monthly budget ($100)');

// BAD: Technical jargon
new Notice('API call succeeded with 200 status');
new Notice('Budget threshold exceeded at 0.85 ratio');
```

---

## 🧪 Testing Strategy

### Unit Tests (Future: v1.1)
```typescript
// Example test structure
describe('SanitizerEngine', () => {
    test('detects patient names with clinical context', () => {
        const text = 'Saw patient John Doe for genetic counseling';
        const result = sanitizer.scan(text);
        expect(result.containsPHI).toBe(true);
        expect(result.violations[0].type).toBe('Patient Name');
    });
});
```

### Integration Tests (Manual for v1.0)
```markdown
1. **Simple Entry Test**
   - Input: 250-word research update (no PHI, no code)
   - Expected: 3-sentence summary, cost < $0.05, latency < 5s

2. **Clinical Entry Test**
   - Input: Entry with p-values, gene names, AUC statistics
   - Expected: Grounding section appears, PubMed articles listed

3. **Code Entry Test**
   - Input: Nextflow process with memory issue
   - Expected: Code audit section with memory fix suggestion

4. **PHI Detection Test**
   - Input: Entry with "MRN: 123456" or "patient John Doe"
   - Expected: Error modal, no API call made, specific violation reported
```

---

## 🚨 Common Pitfalls and How to Avoid Them

### 1. CORS Issues
**Problem:** Direct fetch() calls fail in Obsidian  
**Solution:** Always use `requestUrl()` from Obsidian API

### 2. PHI Leakage
**Problem:** Forgetting to sanitize before API call  
**Solution:** GeminiProvider.generateResearchInsight() MUST call sanitizer first

### 3. Cost Explosion
**Problem:** Using "high" thinking for all entries  
**Solution:** Auto-detect complexity, default to "low" for simple entries

### 4. API Key Exposure
**Problem:** Logging API keys to console  
**Solution:** Never log settings object, always redact sensitive fields

### 5. Mobile Performance
**Problem:** Slow processing on cellular networks  
**Solution:** Reduce thinking level, disable grounding on mobile detection

---

## 🔐 Security Checklist

```markdown
- [ ] API keys stored in data.json (encrypted by Obsidian)
- [ ] No hardcoded credentials in source code
- [ ] PHI sanitizer runs before every API call
- [ ] User content never logged to console
- [ ] Settings UI uses password input for API key
- [ ] Backup files respect .gitignore
- [ ] No eval() or Function() constructors
- [ ] Input validation on all user-provided settings
```

---

## 📊 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Insight Generation | < 5 seconds | Time from button click to modal display |
| PHI Scan | < 100ms | Time to scan 1000-word entry |
| Settings Load | < 200ms | Time to render settings tab |
| Memory Usage | < 50MB | Plugin memory footprint |
| Token Efficiency | < 2000 tokens/entry | Average for standard research update |

---

## 🐛 Debugging Guide

### Enable Debug Mode
1. Settings → Advanced → Debug Mode: ON
2. Open DevTools (Ctrl+Shift+I / Cmd+Opt+I)
3. Filter console to "Gemini Research Brain"

### Common Debug Scenarios

**API Call Failing:**
```typescript
// Check these in order:
1. Is API key set? (Settings → API Configuration)
2. Is network connected? (Try web_search in claude.ai)
3. Is Gemini API endpoint correct? (Check GeminiProvider.API_ENDPOINT)
4. Are headers correct? (x-goog-api-key, not Authorization)
```

**PHI False Positive:**
```typescript
// Check sanitizer patterns:
console.log('Violations:', result.violations);
// Adjust patterns in SanitizerEngine.ts if needed
// Add to exclude list for research codes
```

**Cost Tracking Broken:**
```typescript
// Reset localStorage:
localStorage.removeItem('gemini-research-brain-costs');
// Restart plugin
```

---

## 🚀 Deployment Process

### Pre-Release Checklist
```markdown
1. Code Quality
   - [ ] TypeScript compiles with no errors
   - [ ] All TODO comments resolved or documented
   - [ ] No console.log() in production code
   - [ ] Error handling on all async functions

2. Testing
   - [ ] Manual testing completed (see Integration Tests above)
   - [ ] Tested on Windows, macOS, Linux
   - [ ] Tested on iOS and Android Obsidian apps
   - [ ] PHI detection verified with 10 test cases

3. Documentation
   - [ ] README.md updated with new features
   - [ ] CHANGELOG.md created
   - [ ] Example entries tested and screenshots updated
   - [ ] All links in docs are valid

4. Version Management
   - [ ] manifest.json version bumped
   - [ ] package.json version matches manifest
   - [ ] versions.json updated
   - [ ] Git tag created (v1.0.0)

5. Repository
   - [ ] All files committed
   - [ ] .gitignore includes node_modules, *.zip, data.json
   - [ ] LICENSE file added (MIT)
   - [ ] GitHub release created with zip file
```

### Release Commands
```bash
# 1. Version bump
npm run version

# 2. Production build
npm run build

# 3. Create release package
zip -r gemini-research-brain-v1.0.0.zip \
    main.js \
    manifest.json \
    styles.css \
    prompts/

# 4. Git operations
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main
git push origin v1.0.0

# 5. GitHub release
# Upload gemini-research-brain-v1.0.0.zip to GitHub releases
```

---

## 🤝 Agent Collaboration Notes

### For Claude Code
- You have full access to bash, file creation, and file editing
- Start by reading this AGENTS.md file completely
- Then read CLAUDE.md for architectural decisions
- Create files incrementally, testing each phase
- Ask for human approval before moving to next phase

### For Cursor/Windsurf
- Use this as your primary reference
- Implement in order: Phase 1 → Phase 2 → Phase 3
- Test after each major file creation
- Refer to code examples in this document

### For Other AI Agents
- This document is self-contained
- All architectural decisions documented
- Follow security checklist strictly
- Prioritize user safety (PHI protection) over features

---

## 📞 When to Ask for Help

**Ask Human Developer When:**
- PHI sanitizer is flagging legitimate research content
- API costs exceed $0.10 per entry consistently
- Mobile app crashes or becomes unresponsive
- Gemini API returns unexpected response structure
- TypeScript errors cannot be resolved with documentation

**Don't Ask When:**
- Standard build/compile issues (check docs first)
- Simple TypeScript syntax questions (refer to tsconfig.json)
- UI styling tweaks (experiment freely)
- Adding console.log for debugging (do it)

---

## 🎓 Learning Resources

- **Obsidian Plugin API:** https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- **Gemini API Docs:** https://ai.google.dev/docs
- **PubMed API:** https://www.ncbi.nlm.nih.gov/home/develop/api/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/intro.html
- **HIPAA Compliance:** https://www.hhs.gov/hipaa/for-professionals/privacy/laws-regulations/index.html

---

## ✅ Success Criteria

**Phase 1 Complete When:**
- Plugin loads without errors
- Settings tab displays all options
- Simple entry generates 3-sentence summary
- PHI detection blocks test case with MRN
- Cost tracking shows in settings
- Mobile app works (basic functionality)

**Phase 2 Complete When:**
- Grounding adds verification section
- PubMed returns relevant papers
- Code audit identifies real bugs
- All Phase 1 tests still pass

**Phase 3 Complete When:**
- All modules can be toggled
- Each module produces correct output format
- User can disable any module except Inverted Pyramid
- Performance remains under 5 seconds

**Production Ready When:**
- 100+ test entries processed successfully
- Zero PHI leaks in logs
- Budget enforcement prevents overspending
- Mobile and desktop both stable
- Documentation complete and accurate

---

**Agent, you are now fully equipped to build this plugin. Start with Phase 1, test thoroughly, then proceed to Phase 2. Good luck! 🚀**
