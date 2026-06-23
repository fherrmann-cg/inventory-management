# Vue Component Analyzer - Quick Reference

## What You Built

A Node.js script that analyzes Vue 3 components for performance issues and suggests optimizations. Focus area: **rendering efficiency** (v-show vs v-if, computed vs methods).

## Files Created

```
.claude/
├── analyze-vue.js          # Main analyzer script
├── analyze-vue.sh          # Bash wrapper (optional)
├── ANALYZER_QUICK_GUIDE.md # This file
└── skills/
    └── analyze-vue.yml     # Skill definition (for IDE integration)

VUE_PERFORMANCE_ANALYSIS.md # Full analysis report with fixes
```

## Usage

### Option 1: Run directly with Node.js
```bash
# From project root
node .claude/analyze-vue.js client/src
```

### Option 2: Use bash wrapper
```bash
./.claude/analyze-vue.sh client/src
```

### Option 3: Invoke as Claude Code skill
```
/analyze-vue
/analyze-vue client/src/views
/analyze-vue client/src/components/Dashboard.vue
```

## What It Finds

### 🔴 Critical Issues (Exit Code 1)
- **v-for without :key** - Can cause state corruption
  - Found 5 instances in your project
  - Affects: LanguageSwitcher, TasksModal, Dashboard, Inventory, Spending

### 🟡 Warnings (Exit Code 0)
- **Async computed properties** - Anti-pattern, should be watchers
- **Prop destructuring** - Breaks reactivity, use toRefs()
- **Direct DOM queries** - Use Vue refs instead

### 🔵 Recommendations (Exit Code 0)
- **v-if vs v-show** - 23 instances
  - Suggestion: Use v-show for frequently toggled modals
  
- **Methods vs Computed** - 15 instances
  - Example: CostDetailModal has 5 methods, only 2 computed
  - Computed = cached until dependencies change
  
- **Component extraction** - 7 components >100 lines
  - Dashboard.vue: 429 script lines, 297 template lines
  - Suggestion: Extract into DashboardMetrics, DashboardCharts components
  
- **Lifecycle cleanup** - 9 components
  - Check: onMounted has onUnmounted?
  - Check: watch() has stop/unwatch?
  
- **Watch cleanup** - 8 components
  - Ensure watchers are stopped on unmount

## Key Findings Summary

```
Analyzed: 18 components
Issues:
  🔴 5 Critical   (v-for keys)
  🟡 0 Warnings
  🔵 47 Recommendations

Top Optimization Opportunities:
  1. Fix 5 v-for :key issues (5 mins)
  2. Extract Dashboard.vue (429 lines → 3 components)
  3. Convert 15 methods to computed (2 hours)
  4. Switch 10+ v-if to v-show (30 mins)
  5. Add lifecycle cleanup (1 hour)
```

## How to Fix the Issues

### Issue 1: Missing v-for Keys

**Location:** Dashboard.vue (lines with v-for)

```vue
<!-- BEFORE -->
<div v-for="item in items" :key="index">

<!-- AFTER -->
<div v-for="item in items" :key="item.id">
```

**Why:** Vue uses keys to track which items have changed/added/removed. Without it, DOM state gets mixed up.

### Issue 2: v-if on Modals

**Location:** Modal components (BacklogDetailModal, CostDetailModal, etc.)

```vue
<!-- BEFORE: Destroys/recreates DOM on every toggle -->
<div v-if="isOpen">
  <Modal />
</div>

<!-- AFTER: Just hides/shows with CSS -->
<div v-show="isOpen">
  <Modal />
</div>
```

**Why:** Modal content is expensive. If toggled 3+ times, v-show is faster.

### Issue 3: Methods That Should Be Computed

**Location:** CostDetailModal.vue (5 methods)

```javascript
// BEFORE: Recalculates every render
const calculateTotal = () => {
  return items.value.reduce((sum, i) => sum + i.price, 0)
}

// AFTER: Caches until items changes
const total = computed(() => {
  return items.value.reduce((sum, i) => sum + i.price, 0)
})
```

**Why:** Computed properties cache results. With method, Vue recalculates 100s of times per second.

### Issue 4: Component Extraction

**Location:** Dashboard.vue (429 lines)

```
BEFORE:
Dashboard.vue (429 lines)
  - Summary metrics section
  - Charts section
  - Filter logic
  → All in one component

AFTER:
Dashboard.vue (200 lines) - orchestration
  ├─ DashboardMetrics.vue (100 lines) - metrics display
  ├─ DashboardCharts.vue (150 lines) - chart logic
  └─ composables/useDashboardFilters.js (80 lines) - shared logic
```

**Why:** Smaller components are easier to test, reuse, and maintain.

### Issue 5: Lifecycle Cleanup

**Location:** Dashboard.vue and other view components

```javascript
// BEFORE: Potential memory leak
onMounted(() => {
  window.addEventListener('resize', handleResize)
})
// When component unmounts, listener stays!

// AFTER: Cleanup registered
onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
```

**Why:** Event listeners, subscriptions, timers must be cleaned up. Otherwise they accumulate memory.

## Running Regular Analyses

### Before Each PR
```bash
npm run analyze  # If you add this script to package.json
# or
node .claude/analyze-vue.js client/src
```

### Add to package.json
```json
{
  "scripts": {
    "analyze": "node .claude/analyze-vue.js client/src",
    "dev": "vite",
    "build": "vite build"
  }
}
```

Then run: `npm run analyze`

## Exit Codes

- **0** = No critical issues (warnings/recommendations are OK)
- **1** = Critical issues found (v-for keys, async computed, etc.)

Use in CI/CD to fail builds if critical issues exist:
```yaml
# .github/workflows/analyze.yml
- name: Analyze Vue Components
  run: npm run analyze
```

## Customization

Edit `analyze-vue.js` to:
- Change detection rules
- Add new checks
- Adjust thresholds (e.g., >200 lines instead of >100)
- Change console colors
- Add file exclusions

Key sections:
```javascript
// Line ~100: Add new detection logic
if (/* your pattern */) {
  findings.recommendations.push({
    type: 'YOUR_CATEGORY',
    message: 'Your message',
    severity: 'info', // or 'warning', 'error'
  })
}
```

## Next Steps

1. **Read the full report:** `VUE_PERFORMANCE_ANALYSIS.md`
2. **Fix critical issues:** Start with v-for :key (5 mins work)
3. **Plan refactoring:** Dashboard.vue extraction (biggest impact)
4. **Integrate analyzer:** Add to CI/CD pipeline
5. **Set targets:** 0 critical, <30 recommendations in next sprint

## Questions?

Check the detailed analysis in `VUE_PERFORMANCE_ANALYSIS.md` for:
- Why each issue matters
- How to fix it step-by-step
- Performance impact numbers
- Priority matrix for fixes
