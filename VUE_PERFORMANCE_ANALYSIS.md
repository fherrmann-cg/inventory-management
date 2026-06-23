# Vue Component Performance Analysis Report

Generated: 2026-06-23

## Executive Summary

Analysis of 18 Vue 3 components found **5 critical issues** and **47 optimization recommendations**.

| Category | Count | Priority |
|----------|-------|----------|
| Critical Issues | 5 | 🔴 Fix immediately |
| Warnings | 0 | 🟡 Address soon |
| Recommendations | 47 | 🔵 Nice to have |

---

## Critical Issues 🔴

### 1. Missing `:key` on v-for Loops

**Severity:** CRITICAL - Can cause rendering bugs and state corruption

**Affected Components (5):**
1. `components/LanguageSwitcher.vue` - 1 loop
2. `components/TasksModal.vue` - 1 loop
3. `views/Dashboard.vue` - 2 loops
4. `views/Inventory.vue` - 1 loop
5. `views/Spending.vue` - 1 loop

**Why it matters:**
- Without `:key`, Vue reuses DOM elements when the list changes
- Can cause input state from one item to appear on another
- Breaks component state and animations
- Especially problematic with modals and detail views

**How to fix:**
```vue
<!-- ❌ BAD - Using index -->
<div v-for="(item, index) in items" :key="index">
  {{ item.name }}
</div>

<!-- ✅ GOOD - Using unique ID -->
<div v-for="item in items" :key="item.id">
  {{ item.name }}
</div>
```

**Action Items:**
- [ ] Add `:key` to all v-for loops in LanguageSwitcher.vue
- [ ] Add `:key` to all v-for loops in TasksModal.vue
- [ ] Add `:key` to all v-for loops in Dashboard.vue (2 locations)
- [ ] Add `:key` to all v-for loops in Inventory.vue
- [ ] Add `:key` to all v-for loops in Spending.vue

---

## Performance Recommendations 🔵

### Category 1: v-if vs v-show (23 instances)

**Impact:** Medium - Affects rendering performance

**Pattern:** Many components use `v-if` which removes elements from DOM each time. Better for rarely-shown elements.

**Recommendation:** Use `v-show` for elements toggled 3+ times per session.

**Affected Components:**
- `views/Dashboard.vue` - 4 v-if directives
- `views/Demand.vue` - 4 v-if directives
- `views/Reports.vue` - 3 v-if directives
- `views/Restocking.vue` - 5 v-if directives
- Various modals - 1 v-if each

**Example Fix:**
```vue
<!-- For frequently toggled modals -->
<!-- ❌ BAD: Recreates DOM each time -->
<div v-if="showModal" class="modal">
  <!-- expensive content -->
</div>

<!-- ✅ GOOD: Just toggles display -->
<div v-show="showModal" class="modal">
  <!-- expensive content -->
</div>
```

**Performance Impact:**
- v-if: O(n) mount/unmount cost for large content
- v-show: O(1) CSS toggle cost

---

### Category 2: Methods vs Computed Properties (15 instances)

**Impact:** High - Affects calculation efficiency

**Pattern:** Several components have 3-5 methods that derive data from props/refs

**Recommendation:** Convert pure calculation methods to `computed` properties for caching

**Affected Components:**
- `components/CostDetailModal.vue` - 5 methods, only 2 computed
- `components/InventoryDetailModal.vue` - 5 methods, only 3 computed
- `components/ProfileMenu.vue` - 5 methods, only 1 computed
- `components/LanguageSwitcher.vue` - 2 methods, 0 computed

**Example Fix:**
```javascript
// ❌ BAD - Recalculates on every render
const getTotalPrice = () => {
  return items.value.reduce((sum, item) => sum + item.price, 0)
}

// ✅ GOOD - Caches until dependencies change
const totalPrice = computed(() => {
  return items.value.reduce((sum, item) => sum + item.price, 0)
})
```

**Performance Impact:**
- Methods: O(n) per render = potentially 100s of recalculations/second
- Computed: O(n) only when dependencies change = 1-2 times per user action

---

### Category 3: Component Size & Extraction (7 instances)

**Impact:** Medium - Affects maintainability and reusability

**Large Templates (>100 lines):**
- `views/Dashboard.vue` - 297 lines (CRITICAL)
- `views/Spending.vue` - 172 lines
- `views/Orders.vue` - 129 lines
- `views/Demand.vue` - 111 lines
- `components/InventoryDetailModal.vue` - 105 lines
- `components/TasksModal.vue` - 119 lines

**Large Scripts (>150 lines):**
- `views/Dashboard.vue` - 429 lines (CRITICAL)
- `views/Spending.vue` - 319 lines
- `views/Reports.vue` - 191 lines

**Recommendation:** Extract logical sections into sub-components

**Example Extraction Strategy for Dashboard:**

```
views/Dashboard.vue (429 lines, 297 template)
  ↓ Extract metrics display
  → components/DashboardMetrics.vue
  
  ↓ Extract chart section
  → components/DashboardCharts.vue
  
  ↓ Extract filter logic
  → composables/useDashboardFilters.js
  
Result: 3 focused components + 1 composable
```

**Benefits:**
- ✓ Easier to test individual sections
- ✓ Better reusability (DashboardMetrics could be used elsewhere)
- ✓ Clearer responsibility per component
- ✓ Easier debugging and maintenance

---

### Category 4: Lifecycle Cleanup (9 instances)

**Impact:** High - Can cause memory leaks

**Pattern:** Many view components use `onMounted` but don't have corresponding cleanup

**Affected Components:**
- `views/Dashboard.vue` - Has onMounted, check for cleanup
- `views/Inventory.vue` - Has onMounted, check for cleanup
- `views/Spending.vue` - Has onMounted, check for cleanup
- `views/Backlog.vue` - Has onMounted, check for cleanup
- `views/Demand.vue` - Has onMounted, check for cleanup
- `views/Orders.vue` - Has onMounted, check for cleanup
- `views/Restocking.vue` - Has onMounted, check for cleanup
- `App.vue` - Has onMounted, check for cleanup

**Example Fix:**
```javascript
// ❌ BAD - Potential memory leak
onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll)
  // When component unmounts, listeners stay active!
})

// ✅ GOOD - Cleanup in onUnmounted
onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll)
})
```

**Or use watcher cleanup:**
```javascript
const unsubscribe = watch(dataRef, (newVal) => {
  // ...
})

onUnmounted(() => {
  unsubscribe()
})
```

---

### Category 5: Watch Cleanup (8 instances)

**Impact:** Medium - Can cause memory leaks

**Pattern:** Several views use `watch()` but may not stop watchers

**Affected Components:**
- `views/Dashboard.vue` - 1 watch
- `views/Inventory.vue` - 1 watch
- `views/Spending.vue` - 1 watch
- `views/Backlog.vue` - 1 watch
- `views/Demand.vue` - 1 watch
- `views/Orders.vue` - 1 watch
- `views/Restocking.vue` - (check if has watch)

**Recommendation:** Ensure watchers are properly cleaned up

---

## Optimization Priority Matrix

### Quick Wins (30 mins)
1. Add `:key` to v-for loops in 5 components
2. Review LanguageSwitcher.vue computed properties

### Medium (2-4 hours)
3. Convert 15 methods to computed properties (batch update)
4. Switch 10+ v-if to v-show in view components
5. Add onUnmounted cleanup to 8 components

### Large Tasks (1-2 days)
6. Refactor Dashboard.vue (429 lines → 3 components)
7. Refactor Spending.vue (319 lines → 2 components)
8. Create reusable filter composable

---

## Tool: Vue Component Analyzer

### Usage

Run the analyzer to get current status:

```bash
# Analyze all components
node .claude/analyze-vue.js client/src

# Analyze specific directory
node .claude/analyze-vue.js client/src/views

# Analyze one file
node .claude/analyze-vue.js client/src/components/FilterBar.vue
```

### What It Checks

✓ **Rendering Efficiency**
- v-for with missing :key
- v-if vs v-show usage
- Expensive computations in methods

✓ **Code Quality**
- Methods that should be computed
- Component/script size (extraction opportunities)
- Missing lifecycle cleanup

✓ **Reactivity**
- Prop destructuring issues
- Async computed properties
- Direct DOM queries

✓ **Memory Management**
- onMounted without onUnmounted
- watch() without stop()
- Event listeners not removed

### Output Format

```
components/ComponentName.vue
✗  Critical: Found 1 v-for loops without :key
⚠  Warning: async computed property detected  
ℹ  Info: Consider using v-show instead of v-if
```

---

## Next Steps

1. **This Sprint:**
   - Fix all critical v-for :key issues (5 components)
   - Refactor Dashboard.vue into 3 smaller components
   - Convert high-priority methods to computed

2. **Next Sprint:**
   - Refactor Spending.vue and Orders.vue
   - Add lifecycle cleanup to all view components
   - Create filter composable

3. **Ongoing:**
   - Run analyzer before each PR
   - Target: 0 critical issues, <20 recommendations
   - Maintain component size: <100 template lines, <150 script lines

---

## References

- [Vue 3 Performance Optimization Guide](https://vuejs.org/guide/best-practices/performance.html)
- [Vue 3 Reactivity Best Practices](https://vuejs.org/guide/best-practices/)
- [Composition API Patterns](https://vuejs.org/guide/extras/composition-api-faq.html)
