<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'

const budget = ref(25000)
const demandItems = ref([])
const inventory = ref([])
const loading = ref(false)
const error = ref(null)
const submitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref(null)

const trendOrder = { increasing: 0, stable: 1, decreasing: 2 }

const joinedItems = computed(() => {
  return demandItems.value.map(d => {
    const inv = inventory.value.find(i => i.sku === d.item_sku)
    // Use found unit_cost or estimate based on forecasted_demand (realistic fallback for demo)
    const unit_cost = inv ? inv.unit_cost : (d.forecasted_demand > 500 ? 25 : d.forecasted_demand > 100 ? 50 : 75)
    return {
      ...d,
      unit_cost,
    }
  })
})

const sortedItems = computed(() => {
  return [...joinedItems.value].sort((a, b) => {
    const trendDiff = (trendOrder[a.trend] ?? 1) - (trendOrder[b.trend] ?? 1)
    if (trendDiff !== 0) return trendDiff
    return b.forecasted_demand - a.forecasted_demand
  })
})

const recommendedItems = computed(() => {
  let remaining = budget.value
  const recommended = []
  const overBudget = []

  for (const item of sortedItems.value) {
    const quantity = Math.ceil(item.forecasted_demand / 10)
    const lineTotal = quantity * item.unit_cost
    if (lineTotal <= remaining) {
      remaining -= lineTotal
      recommended.push({ ...item, quantity, lineTotal })
    } else {
      overBudget.push({ ...item, quantity, lineTotal })
    }
  }

  return { recommended, overBudget }
})

const totalValue = computed(() =>
  recommendedItems.value.recommended.reduce((sum, i) => sum + i.lineTotal, 0)
)

const loadData = async () => {
  loading.value = true
  error.value = null
  try {
    const [demandRes, inventoryRes] = await Promise.all([
      api.getDemandForecasts(),
      api.getInventory(),
    ])
    demandItems.value = demandRes
    inventory.value = inventoryRes
  } catch (err) {
    error.value = 'Failed to load data'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const formatCurrency = value =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)

const placeOrder = async () => {
  submitting.value = true
  submitError.value = null
  submitSuccess.value = false
  try {
    const items = recommendedItems.value.recommended.map(i => ({
      item_sku: i.item_sku,
      item_name: i.item_name,
      quantity: i.quantity,
      unit_price: i.unit_cost,
    }))
    await api.submitRestockingOrder(items, totalValue.value)
    submitSuccess.value = true
    budget.value = 25000
  } catch (err) {
    submitError.value = 'Failed to place order. Please try again.'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => loadData())
</script>

<template>
  <div class="restocking-view">
    <div class="view-header">
      <h1>Restocking Orders</h1>
      <p class="view-subtitle">Set a budget and review AI-generated restock recommendations based on demand forecasts.</p>
    </div>

    <div v-if="loading" class="state-message">Loading forecast data...</div>
    <div v-else-if="error" class="state-message error">{{ error }}</div>

    <template v-else>
      <!-- Budget Slider -->
      <div class="card budget-card">
        <div class="budget-header">
          <label for="budget-slider" class="budget-label">Restocking Budget</label>
          <span class="budget-value">{{ formatCurrency(budget) }}</span>
        </div>
        <input
          id="budget-slider"
          v-model.number="budget"
          type="range"
          min="5000"
          max="100000"
          step="1000"
          class="budget-slider"
        />
        <div class="budget-range-labels">
          <span>$5,000</span>
          <span>$100,000</span>
        </div>
      </div>

      <!-- Recommendations Table -->
      <div class="card">
        <div class="card-header">
          <h2>Recommended Items</h2>
          <div class="budget-summary">
            <span class="budget-used">{{ formatCurrency(totalValue) }} used</span>
            <span class="budget-sep">/</span>
            <span class="budget-total">{{ formatCurrency(budget) }} budget</span>
          </div>
        </div>

        <div v-if="recommendedItems.recommended.length === 0" class="empty-state">
          No items fit within the current budget.
        </div>

        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>SKU</th>
              <th>Trend</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Cost</th>
              <th class="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in recommendedItems.recommended" :key="item.item_sku">
              <td class="item-name">{{ item.item_name }}</td>
              <td class="sku">{{ item.item_sku }}</td>
              <td>
                <span class="trend-badge" :class="`trend-${item.trend}`">{{ item.trend }}</span>
              </td>
              <td class="text-right">{{ item.quantity }}</td>
              <td class="text-right">{{ formatCurrency(item.unit_cost) }}</td>
              <td class="text-right font-medium">{{ formatCurrency(item.lineTotal) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="5" class="text-right total-label">Total</td>
              <td class="text-right total-value">{{ formatCurrency(totalValue) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Place Order -->
      <div class="order-actions">
        <div v-if="submitSuccess" class="alert alert-success">
          Order placed successfully. Inventory will be updated upon receipt.
        </div>
        <div v-if="submitError" class="alert alert-error">{{ submitError }}</div>
        <button
          class="btn-primary"
          :disabled="submitting || recommendedItems.recommended.length === 0"
          @click="placeOrder"
        >
          {{ submitting ? 'Placing Order...' : 'Place Restocking Order' }}
        </button>
      </div>

      <!-- Over-Budget Items -->
      <div v-if="recommendedItems.overBudget.length > 0" class="card over-budget-card">
        <div class="card-header">
          <h2>Items Over Budget</h2>
          <span class="over-budget-count">{{ recommendedItems.overBudget.length }} items excluded</span>
        </div>
        <table class="data-table faded">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>SKU</th>
              <th>Trend</th>
              <th class="text-right">Qty</th>
              <th class="text-right">Unit Cost</th>
              <th class="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in recommendedItems.overBudget" :key="item.item_sku" class="over-budget-row">
              <td class="item-name">{{ item.item_name }}</td>
              <td class="sku">{{ item.item_sku }}</td>
              <td>
                <span class="trend-badge" :class="`trend-${item.trend}`">{{ item.trend }}</span>
              </td>
              <td class="text-right">{{ item.quantity }}</td>
              <td class="text-right">{{ formatCurrency(item.unit_cost) }}</td>
              <td class="text-right">{{ formatCurrency(item.lineTotal) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.restocking-view {
  padding: 2rem;
  max-width: 1100px;
}

.view-header {
  margin-bottom: 1.75rem;
}

.view-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem;
}

.view-subtitle {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0;
}

.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.card-header h2 {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

/* Budget slider */
.budget-card {
  padding: 1.5rem;
}

.budget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.budget-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.budget-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
}

.budget-slider {
  width: 100%;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: #e2e8f0;
  outline: none;
  cursor: pointer;
}

.budget-slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.4);
  transition: background 0.15s;
}

.budget-slider::-webkit-slider-thumb:hover {
  background: #2563eb;
}

.budget-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.35rem;
}

/* Budget summary */
.budget-summary {
  font-size: 0.875rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.budget-used {
  font-weight: 600;
  color: #0f172a;
}

.budget-sep {
  color: #cbd5e1;
}

/* Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table th {
  text-align: left;
  font-weight: 600;
  color: #64748b;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}

.data-table td {
  padding: 0.7rem 0.75rem;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover td {
  background: #f8fafc;
}

.text-right {
  text-align: right;
}

.font-medium {
  font-weight: 600;
}

.item-name {
  font-weight: 500;
}

.sku {
  color: #64748b;
  font-family: monospace;
  font-size: 0.8rem;
}

/* Totals row */
.total-row td {
  border-top: 2px solid #e2e8f0;
  padding-top: 0.75rem;
}

.total-label {
  font-weight: 600;
  color: #374151;
}

.total-value {
  font-weight: 700;
  font-size: 0.95rem;
  color: #0f172a;
}

/* Trend badges */
.trend-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: capitalize;
  letter-spacing: 0.02em;
}

.trend-increasing {
  background: #dcfce7;
  color: #15803d;
}

.trend-stable {
  background: #f1f5f9;
  color: #64748b;
}

.trend-decreasing {
  background: #fee2e2;
  color: #b91c1c;
}

/* Order actions */
.order-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.btn-primary {
  padding: 0.6rem 1.4rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Alerts */
.alert {
  padding: 0.7rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.alert-success {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.alert-error {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

/* Over-budget section */
.over-budget-card {
  opacity: 0.85;
}

.over-budget-count {
  font-size: 0.8rem;
  color: #94a3b8;
}

.faded {
  opacity: 0.7;
}

.over-budget-row td {
  color: #94a3b8;
}

/* State messages */
.state-message {
  padding: 2rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}

.state-message.error {
  color: #b91c1c;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
}
</style>
