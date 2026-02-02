# 🧠 CLAUDE.md - Architectural Decisions & Discussion Log

This document captures the key architectural decisions, design rationale, and evolution of requirements from the original discussion with the user (Shibi).

---

## 👤 User Context

**Name:** Shibi  
**Role:** Physician-scientist entrepreneur  
**Experience:** 20+ years in biological research, NGS analysis, clinical genomics  
**Technical Background:**
- Whole Exome/Genome Sequencing (WES/WGS) - both germline and somatic
- Bioinformatics pipelines (Nextflow, AWS)
- Clinical trial management
- PubMed literature review and scientific presentations

**Use Case:** Needs an AI-powered research journal that:
1. Structures daily notes using journalistic frameworks
2. Verifies clinical claims against literature
3. Audits bioinformatics code
4. Maintains HIPAA compliance
5. Integrates with PubMed for literature context

---

## 🎯 Project Evolution

### Original Concept (User's Initial Blueprint)
The user shared a blueprint for a "Second Brain" Obsidian plugin using Gemini 3 Pro with these features:
- Inverted Pyramid summarization (journalism)
- Media Frame Analysis (cognitive bias detection)
- "The Connector" (Zettelkasten-style linking)
- Shadow Mirror (omission analysis)
- Grounding for medical/research verification

**Issues Identified:**
1. ❌ Over-engineering (5 modules at once)
2. ❌ No PHI/PII safeguards
3. ❌ Cost explosion risk (high thinking on every entry)
4. ❌ No offline fallback
5. ❌ Missing error boundaries
6. ❌ Unnecessary Svelte complexity

### Refined Architecture (Our Recommendations)
**Phase 1: Foundation (Week 1-2)**
- Single feature: Inverted Pyramid only
- PHI sanitizer (CRITICAL)
- Cost tracking
- Manual trigger (no auto-processing)

**Phase 2: Research Intelligence (Week 3-4)**
- Google Search Grounding
- PubMed MCP integration
- Code Auditor

**Phase 3: Cognitive Modules (Week 5-8)**
- Frame Analysis
- Vault Connector
- 5-Whys, Shadow Prompt (optional)

**Rationale:** Start simple, validate core value, then add complexity.

### User Decisions (Configuration Phase)

**Question 1: API Budget**
- **Decision:** $100/month
- **Implication:** ~2000 high-thinking entries or ~5000 low-thinking entries
- **Action:** Set budget enforcement in CostTracker

**Question 2: PubMed Integration**
- **Decision:** Use PubMed MCP server (not web_search, not direct API)
- **Implication:** Requires MCP setup, provides structured metadata
- **Action:** Build PubMedConnector.ts with MCP tool calls

**Question 3: Gamma AI Integration**
- **Decision:** Skip for v1.0, add to roadmap
- **Implication:** Keep it simple initially, users can copy-paste to Gamma manually
- **Action:** Document in roadmap for v1.1

**Question 4: Architecture Approach**
- **Decision:** Cloud-native (no local processing except Obsidian notes)
- **Implication:** All AI analysis via Gemini API, faster iteration, simpler architecture
- **Action:** Remove any local NLP/TF-IDF requirements initially

**Question 5: Testing Focus**
- **Decision:** Core implementation now, extensive testing later
- **Implication:** Manual integration tests for v1.0, automated tests for v1.1
- **Action:** Create test roadmap but don't block deployment

---

## 🏗️ Key Architectural Decisions

### 1. Cloud-Native Processing
**Decision:** All analysis happens via Gemini API, no local inference  
**Rationale:**
- User has $100 budget (sufficient for cloud processing)
- Simpler architecture (no local models to maintain)
- Faster development (leverage Gemini's capabilities fully)
- Better accuracy (Gemini 3 Pro > local LLMs for specialized tasks)

**Trade-offs:**
- ✅ Pro: No offline mode complexity
- ✅ Pro: Always use latest Gemini capabilities
- ❌ Con: Requires internet connection
- ❌ Con: API costs (mitigated by budget tracking)

### 2. PHI-First Safety Model
**Decision:** Sanitizer MUST run before every API call, hard block on PHI  
**Rationale:**
- User works with clinical data (Lynch syndrome, ctDNA studies)
- HIPAA compliance is non-negotiable
- False positive is better than false negative (user can sanitize and retry)

**Implementation:**
```typescript
async generateResearchInsight(entry: string, options: any) {
    const analysis = await this.analyzeContent(entry);
    
    if (analysis.containsPHI) {
        throw new Error('⚠️ PHI detected. Cannot process.');
    }
    
    // Only proceed if safe
    const response = await this.callGeminiAPI(entry);
    // ...
}
```

**Patterns Detected:**
- Medical Record Numbers (MRN: 123456)
- Patient names with clinical context
- Dates of birth
- Social Security Numbers
- Specific service dates
- Ages >89 years (HIPAA Safe Harbor)

### 3. Obsidian Sync Compatibility
**Decision:** Backup system leverages Obsidian Sync, no custom cloud storage  
**Rationale:**
- User already pays for Obsidian Sync (likely)
- Avoids managing AWS/GCP credentials
- Simpler for users without technical background
- Maintains user's existing backup workflow

**Future Enhancement:** Google Drive option for non-Sync users (v1.1)

### 4. Progressive Module Enablement
**Decision:** All modules can be toggled individually (except Inverted Pyramid)  
**Rationale:**
- Users have different workflows
- Cost-conscious users can disable expensive features (Grounding)
- Some features are uncomfortable (Shadow Prompt) - must be opt-in
- Inverted Pyramid is core value, always enabled

**Settings Structure:**
```typescript
modules: {
    invertedPyramid: true,      // Cannot be disabled
    frameAnalysis: boolean,      // Opt-in
    vaultConnector: boolean,     // Opt-in
    shadowPrompt: boolean,       // Opt-in (uncomfortable)
    fiveWhys: boolean,           // Opt-in
}
```

### 5. Vault Connector: Cloud Inference vs Local TF-IDF
**Decision:** Use Gemini's inference to suggest links (cloud-based)  
**Original Plan:** Local TF-IDF similarity scoring  
**Change Rationale:**
- Cloud-native architecture (no local processing)
- Gemini can infer likely note titles from context
- Simpler implementation (no need for TF-IDF library)
- More flexible (handles synonyms, conceptual similarity)

**Output Example:**
```markdown
## 🔗 Suggested Vault Connections

**Potential Links:**
- [[Lynch Syndrome Literature Review]] — If tracking MLH1/MSH2 variants
- [[GATK Best Practices 2025]] — Pipeline methodology reference

Consider linking to existing notes on [topic] to build knowledge graph.
```

**Limitation:** Cannot guarantee note existence, uses probabilistic inference

### 6. Thinking Level Auto-Detection
**Decision:** Auto-detect complexity, don't always use "high"  
**Rationale:**
- Cost optimization ($0.02 vs $0.05 per entry)
- User has $100 budget (need to be efficient)
- Many entries are simple (meeting notes, task lists)

**Detection Logic:**
```typescript
const complexityIndicators = [
    hasClinicalClaims,      // p-values, statistics
    hasBiomedicalTerms,     // genes, variants
    hasCodeBlocks,          // Nextflow, Python
    hasStatistics,          // >2 statistical values
    wordCount > 500,        // Long entry
    geneCount > 3,          // Multiple genes mentioned
];

const score = indicators.filter(Boolean).length;
return score >= 3 ? 'high' : 'low';
```

### 7. System Prompt Organization
**Decision:** Split into 3 XML files, not single monolithic prompt  
**Files:**
1. `system-instruction.xml` - Base frameworks (8KB)
2. `medical-research-mode.xml` - Clinical verification (5KB)
3. `code-auditor-mode.xml` - Pipeline analysis (4KB)

**Rationale:**
- Modular prompts are easier to maintain
- Only load needed prompts (cost optimization)
- Clear separation of concerns
- Easier to test individual modules

**Loading Strategy:**
```typescript
const systemPrompt = this.systemInstruction 
    + (medicalMode ? this.medicalModeInstruction : '')
    + (hasCode ? this.codeAuditorInstruction : '');
```

### 8. PubMed MCP Integration Pattern
**Decision:** Use MCP server, not direct PubMed E-utilities API  
**Rationale:**
- MCP provides structured responses (easier parsing)
- Handles authentication and rate limiting
- Future-proof (MCP is expanding to more services)
- Consistent with Anthropic's ecosystem

**Workflow:**
```typescript
1. Extract terms (genes, diseases, methods)
2. Build optimized query: "BRCA1 AND breast neoplasms AND 2020:2026[pdat]"
3. Call PubMed:search_articles (get PMIDs)
4. Call PubMed:get_article_metadata (get full citations)
5. Display top 3-5 papers with relevance notes
```

---

## 🔬 Domain-Specific Decisions

### Genomics Focus
**Decision:** Preserve ALL scientific notation exactly  
**Rationale:**
- User works with clinical variants (HGVS notation critical)
- Any alteration could cause misinterpretation
- ClinVar submissions require exact notation

**Protected Elements:**
- Gene symbols: BRCA1, TP53, MLH1
- HGVS variants: c.1234G>A, p.Arg248Gln
- Accessions: NM_000546.5, NP_000537.3
- dbSNP IDs: rs80357713
- Statistical values: p < 0.05, AUC = 0.89
- Reference builds: hg19, hg38, GRCh37

**System Prompt Instruction:**
```xml
<preserve_exactly>
You MUST preserve these character-for-character:
- Gene symbols
- HGVS notation
- Statistical values
- PubMed IDs
[Never round, never reformat]
</preserve_exactly>
```

### Clinical Trial Context
**Decision:** Include regulatory guidance in prompts  
**Rationale:**
- User runs clinical trials (Phase I-III experience)
- Needs FDA/IRB context in insights
- Regulatory compliance is critical

**Frameworks Added:**
- IRB protocol amendment triggers
- DSMB reporting thresholds
- FDA endpoint definitions (OS, PFS, ORR)
- Statistical power considerations

### Bioinformatics Pipelines
**Decision:** Code Auditor focuses on NGS-specific issues  
**Rationale:**
- User works with Nextflow, GATK, AWS
- Generic code review insufficient
- Need domain expertise in prompts

**Bioinformatics-Specific Checks:**
- VCF parsing edge cases (multiallelic sites)
- Reference genome build consistency
- Tool version compatibility
- AWS cost optimization (spot instances)
- Memory allocation for GATK (common 16GB → 32GB fix)

---

## 🎨 UI/UX Decisions

### 1. Preview Modal (Not Auto-Insert)
**Decision:** Always show preview modal before inserting  
**Rationale:**
- PHI risk (user needs to review)
- Costly to regenerate if user dislikes output
- Transparency in AI operations

**Override:** Auto-insert toggle in settings (power users)

### 2. Cost Dashboard Prominence
**Decision:** Show cost stats at top of settings page  
**Rationale:**
- Budget is hard constraint ($100)
- Users need constant awareness
- Prevents bill shock

**Metrics Displayed:**
- Current month spend
- Remaining budget
- Projected end-of-month cost
- Average cost per entry

### 3. Mobile Optimization
**Decision:** Reduce features on mobile, not just hide UI  
**Rationale:**
- Mobile networks are slower (Grounding takes longer)
- Mobile users often have less time
- Cost-conscious (cellular data)

**Mobile Adaptations:**
- Default to "low" thinking
- Disable Grounding by default
- Smaller token limits
- Simplified UI

---

## 🛠️ Technology Stack Rationale

### Why Gemini 3 Pro (not Claude, GPT-4, or local models)
**Reasons:**
1. ✅ Native Google Search Grounding
2. ✅ Thinking mode (explicit reasoning)
3. ✅ Long context (2M tokens - future use)
4. ✅ Good at structured outputs (XML parsing)
5. ✅ Cost-effective for this use case

**Not Claude:** No native grounding (would need web_search tool)  
**Not GPT-4:** More expensive, no thinking mode  
**Not Local Models:** Accuracy insufficient for clinical use

### Why TypeScript (not JavaScript)
**Reasons:**
1. ✅ Type safety (catch bugs at compile time)
2. ✅ Better IDE support (autocomplete)
3. ✅ Obsidian plugin API is typed
4. ✅ Easier to maintain long-term

### Why esbuild (not webpack, rollup)
**Reasons:**
1. ✅ Faster build times
2. ✅ Simpler configuration
3. ✅ Watch mode for development
4. ✅ Obsidian sample plugin uses it

### Why No Testing Framework Initially
**Decision:** Manual testing for v1.0, Jest for v1.1  
**Rationale:**
- User prioritized core implementation over testing
- Manual integration tests sufficient for beta
- Automated tests add complexity (setup, mocking, CI/CD)
- Can add tests after proving product-market fit

**Testing Roadmap:**
- v1.0: Manual integration tests
- v1.1: Jest + @testing-library for unit tests
- v1.2: E2E tests with Playwright

---

## 💡 Feature Trade-offs

### Included in v1.0
1. ✅ Inverted Pyramid (core value)
2. ✅ PHI Sanitizer (safety requirement)
3. ✅ Cost Tracker (budget constraint)
4. ✅ Google Search Grounding (differentiator)
5. ✅ PubMed Integration (user's workflow)
6. ✅ Code Auditor (user codes daily)
7. ✅ Frame Analysis (cognitive value)
8. ✅ Vault Connector (knowledge graph)
9. ✅ 5-Whys (common use case)

### Deferred to v1.1+
1. ⏳ Gamma AI export (user doesn't need immediately)
2. ⏳ Google Drive backup (Obsidian Sync covers most users)
3. ⏳ Narrative Arc (weekly synthesis - lower priority)
4. ⏳ Automated testing (manual tests sufficient initially)
5. ⏳ Local LLM option (cloud-native for now)

### Explicitly Excluded
1. ❌ Svelte UI framework (unnecessary complexity)
2. ❌ obsidian-dataview dependency (use native API)
3. ❌ Local TF-IDF (cloud inference sufficient)
4. ❌ Real-time auto-processing (PHI risk)
5. ❌ Multiple Gemini models (stick to 3 Pro)

---

## 🔒 Security & Privacy Architecture

### PHI Protection Layers
**Layer 1: Client-Side Scanning**
- Regex patterns for common PHI
- Blocks processing before API call
- User informed of specific violation

**Layer 2: User Review**
- Preview modal shows content before insertion
- User can catch edge cases sanitizer missed
- Undo option (delete insight from note)

**Layer 3: No Logging**
- User content never written to console
- API requests not logged (except in debug mode)
- Backup manifests don't contain entry text

**Layer 4: Secure Storage**
- API keys in Obsidian's encrypted data.json
- No credentials in localStorage
- Settings UI uses password input type

### Data Retention Policy
**What's Stored:**
- Cost statistics (localStorage, monthly auto-reset)
- Plugin settings (Obsidian data.json)
- Backup manifests (in vault, user controls)

**What's NOT Stored:**
- Journal entry content (transient, API only)
- API responses (except in note if user accepts)
- PHI violations (alerts only, no logging)

**User Control:**
- Clear cost stats anytime
- Delete backups manually
- Export settings for portability

---

## 📊 Performance Benchmarks

### Target Latency
| Operation | Target | Rationale |
|-----------|--------|-----------|
| PHI Scan | <100ms | User shouldn't notice delay |
| API Call | 2-5s | Gemini thinking time |
| Modal Render | <200ms | Instant feedback |
| Settings Load | <200ms | Native UI feel |

### Token Efficiency
| Entry Type | Expected Tokens | Cost |
|------------|-----------------|------|
| Simple (admin note) | 500-800 | $0.01-0.02 |
| Standard (research update) | 1200-1800 | $0.04-0.06 |
| Complex (code + grounding) | 2500-4000 | $0.08-0.12 |

**Monthly Budget Math:**
- $100 budget
- Avg $0.05/entry
- = 2000 entries/month
- = ~66 entries/day (unrealistic, so budget is safe)

---

## 🚀 Deployment Philosophy

### Progressive Rollout
1. **Pre-Alpha:** Developer testing (weeks 1-2)
2. **Alpha:** 5 researcher colleagues (weeks 3-4)
3. **Beta:** 20 clinician-scientists via BRAT (weeks 5-8)
4. **v1.0:** Public community plugin submission (week 9)

**Why Not Ship Everything at Once:**
- Catch bugs with small user base first
- Gather feedback to prioritize features
- Build trust with early adopters
- Avoid overwhelming support load

### Version Numbering
- **v1.0.x:** Bug fixes only
- **v1.x.0:** New features (Gamma, Drive)
- **v2.0.0:** Breaking changes (local LLM option)

---

## 🤔 Open Questions & Future Decisions

### 1. Gamma AI Integration (v1.1)
**Question:** Export full insight or just bullet points?  
**Options:**
- A) Full markdown export (preserves all formatting)
- B) Bullet points only (cleaner slides)
- C) User choice (dropdown in settings)

**Defer Decision:** Test with users first, see what they prefer

### 2. Google Drive Backup (v1.1)
**Question:** Use OAuth or require API key?  
**Options:**
- A) OAuth flow (better UX, complex implementation)
- B) Service account key (simpler, requires JSON file)

**Defer Decision:** See user demand first (maybe Obsidian Sync is enough)

### 3. Narrative Arc Implementation
**Question:** Weekly synthesis or manual trigger?  
**Options:**
- A) Auto-trigger every Sunday (could be annoying)
- B) Manual command "Synthesize Week"
- C) Both (auto + manual override)

**Defer Decision:** v1.0 doesn't include this, gather feedback

### 4. Local LLM Support (v2.0)
**Question:** Which models to support?  
**Options:**
- A) Ollama (easiest local setup)
- B) LM Studio (better UI)
- C) Hugging Face Transformers (most flexible)
- D) All of the above (via unified interface)

**Defer Decision:** Cloud-native for now, revisit after v1.0 adoption

---

## 📚 Lessons from Discussion

### What User Really Wanted
1. **Not a chatbot** - a structured analysis tool
2. **Not generic summaries** - domain-specific insights
3. **Not another note-taker** - an AI research assistant
4. **Not experimental tech** - production-ready reliability

### What Made This Design Better
1. ✅ **Iterative phases** (not big bang)
2. ✅ **Safety-first** (PHI protection upfront)
3. ✅ **Cost-conscious** (budget tracking built-in)
4. ✅ **Domain-specific** (genomics, trials, pipelines)
5. ✅ **User control** (preview, toggles, budget limits)

### What We Avoided
1. ❌ Over-engineering (Svelte, multiple LLMs)
2. ❌ Feature creep (weekly synthesis, local models)
3. ❌ Premature optimization (extensive testing)
4. ❌ Complexity without value (TF-IDF, custom NLP)

---

## 🎯 Success Metrics (Revisited)

### User Success
- User journals 5+ times per week consistently
- Cost stays under $50/month (50% of budget)
- Zero PHI incidents reported
- User recommends to 3+ colleagues

### Technical Success
- 95%+ API success rate
- <5s average insight generation time
- Zero data loss incidents
- <10 critical bugs reported in first month

### Product Success
- 100+ downloads in first month
- 50+ weekly active users by month 3
- 4.0+ star rating
- Featured in Obsidian community roundup

---

## 🔄 Changelog of Major Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| Initial | All features at once | User's original blueprint |
| Refinement | Phased approach | Reduce complexity, validate value |
| API Budget | $100/month | User confirmed budget |
| PubMed | Use MCP server | Structured data, future-proof |
| Gamma | Defer to v1.1 | Not immediately needed |
| Architecture | Cloud-native | User preference, simpler |
| Testing | Manual for v1.0 | Prioritize core implementation |

---

## 💬 User Feedback Integration Points

### Alpha Testing Feedback Loop
1. User tries plugin with real research notes
2. Reports: bugs, confusion, missing features
3. We iterate on: UX, prompts, error messages
4. Release alpha v0.2.0
5. Repeat

### Beta Testing Questions
1. Is PHI detection too sensitive? (false positives)
2. Are insights actually useful? (not just impressive)
3. Is cost acceptable? (avg $/month)
4. What features are used? (module adoption rates)
5. Mobile experience acceptable?

---

## 🏁 Final Architectural Statement

**This plugin is:**
- A specialized tool for research scientists
- Built on Gemini 3 Pro for domain expertise
- Safety-first with HIPAA compliance
- Cost-conscious with budget controls
- Progressively developed (v1.0 → v1.1 → v2.0)

**This plugin is NOT:**
- A general-purpose AI assistant
- A replacement for scientific literature review
- A clinical decision support tool
- A data analysis platform
- A collaboration tool (single-user focused)

---

**For AI agents reading this: You now understand not just WHAT to build, but WHY each decision was made. Build thoughtfully. 🧬**
