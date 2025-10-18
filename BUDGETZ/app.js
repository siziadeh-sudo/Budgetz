// Budgetz - a minimal budgeting SPA that uses localStorage
// Features: income, add bills, weekly/monthly toggle, mark paid, chart, export/import/reset

const LS_KEY = 'budgetz_data_v1';

const defaultState = {
  income: 0,
  bills: [
    // example
    // { id: 'uuid', name:'Rent', amount:1200, category:'Housing', due:'2025-10-01', recurring:true, paidForPeriod:false }
  ],
  view: 'monthly' // or 'weekly'
};

let state = loadState();

// ---------- DOM ----------
const incomeInput = document.getElementById('incomeInput');
const saveIncomeBtn = document.getElementById('saveIncomeBtn');
const viewBtns = document.querySelectorAll('.view-btn');
const balanceDisplay = document.getElementById('balanceDisplay');
const summaryLine = document.getElementById('summaryLine');

const addBillForm = document.getElementById('addBillForm');
const billName = document.getElementById('billName');
const billAmount = document.getElementById('billAmount');
const billCategory = document.getElementById('billCategory');
const billDueDate = document.getElementById('billDueDate');
const billRecurring = document.getElementById('billRecurring');
const clearFormBtn = document.getElementById('clearForm');

const billsList = document.getElementById('billsList');

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const resetBtn = document.getElementById('resetBtn');

const ctx = document.getElementById('expenseChart').getContext('2d');
let chart = null;

// ---------- Init ----------
renderAll();
attachHandlers();

// ---------- Functions ----------
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultState));
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load state', e);
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  renderAll();
}

function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 9);
}

function attachHandlers() {
  // income
  incomeInput.value = state.income || '';
  saveIncomeBtn.addEventListener('click', () => {
    const val = parseFloat(incomeInput.value || 0);
    state.income = isNaN(val) ? 0 : val;
    saveState();
  });

  // view toggle
  viewBtns.forEach(b => b.addEventListener('click', () => {
    viewBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.view = b.dataset.view;
    saveState();
  }));

  // add bill
  addBillForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = billName.value.trim();
    const amt = parseFloat(billAmount.value || 0);
    if (!name || isNaN(amt)) {
      alert('Please provide a name and valid amount');
      return;
    }
    const item = {
      id: uid(),
      name,
      amount: amt,
      category: billCategory.value.trim() || 'Other',
      due: billDueDate.value || '',
      recurring: billRecurring.checked,
      paidForPeriod: false
    };
    state.bills.unshift(item);
    clearBillForm();
    saveState();
  });

  clearFormBtn.addEventListener('click', (e) => { e.preventDefault(); clearBillForm(); });

  // export/import/reset
  exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budgetz-data.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
      // quick validation
      parsed.income = Number(parsed.income) || 0;
      parsed.bills = Array.isArray(parsed.bills) ? parsed.bills : [];
      state = parsed;
      saveState();
      alert('Data imported.');
    } catch (err) {
      alert('Import failed: ' + err.message);
      console.error(err);
    } finally {
      importFile.value = '';
    }
  });

  resetBtn.addEventListener('click', () => {
    if (!confirm('Reset all Budgetz data? This cannot be undone.')) return;
    state = JSON.parse(JSON.stringify(defaultState));
    saveState();
  });
}

function clearBillForm() {
  billName.value = '';
  billAmount.value = '';
  billCategory.value = '';
  billDueDate.value = '';
  billRecurring.checked = false;
}

function renderAll() {
  // income & view active
  incomeInput.value = state.income || '';
  viewBtns.forEach(b => b.classList.toggle('active', b.dataset.view === state.view));

  renderBills();
  renderSummary();
  renderChart();
}

function renderBills() {
  billsList.innerHTML = '';
  if (!state.bills.length) {
    billsList.innerHTML = '<div class="notes">No bills yet. Add your monthly/weekly bills above.</div>';
    return;
  }

  state.bills.forEach(b => {
    const item = document.createElement('div');
    item.className = 'bill-item';

    const left = document.createElement('div');
    left.className = 'bill-left';

    const name = document.createElement('div');
    name.innerHTML = `<strong>${escapeHtml(b.name)}</strong><div class="bill-meta">${escapeHtml(b.category)} ${b.due ? ' • due ' + b.due : ''}${b.recurring ? ' • recurring' : ''}</div>`;

    left.appendChild(name);

    const right = document.createElement('div');
    right.className = 'bill-right';

    const amount = document.createElement('div');
    amount.innerHTML = `<div style="font-weight:700">$${formatMoney(displayAmountForView(b.amount))}</div>`;

    const actions = document.createElement('div');
    actions.className = 'bill-actions';

    const paidBtn = document.createElement('button');
    paidBtn.textContent = b.paidForPeriod ? 'Paid ✓' : 'Mark Paid';
    paidBtn.addEventListener('click', () => {
      b.paidForPeriod = !b.paidForPeriod;
      saveState();
    });

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editBill(b.id));

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (!confirm('Delete this bill?')) return;
      state.bills = state.bills.filter(x => x.id !== b.id);
      saveState();
    });

    actions.appendChild(paidBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    right.appendChild(amount);
    right.appendChild(actions);

    item.appendChild(left);
    item.appendChild(right);

    billsList.appendChild(item);
  });
}

function displayAmountForView(amount) {
  // if weekly view, convert monthly amount to weekly (approx)
  if (state.view === 'weekly') {
    // approximate: 1 month ≈ 4.345 weeks
    return amount / 4.345;
  }
  return amount;
}

function renderSummary() {
  // sum of bills (excluding paidForPeriod)
  const totalExpenses = state.bills.reduce((s, b) => s + (b.paidForPeriod ? 0 : displayAmountForView(b.amount)), 0);
  const income = Number(state.income) || 0;
  const balance = income - totalExpenses;
  balanceDisplay.textContent = `$${formatMoney(balance)}`;
  summaryLine.textContent = `Expenses: $${formatMoney(totalExpenses)}`;
}

function renderChart() {
  // group by category
  const bucket = {};
  state.bills.forEach(b => {
    const amt = b.paidForPeriod ? 0 : displayAmountForView(b.amount);
    const cat = b.category || 'Other';
    bucket[cat] = (bucket[cat] || 0) + amt;
  });
  const labels = Object.keys(bucket);
  const data = labels.map(l => bucket[l]);

  if (chart) {
    chart.destroy();
    chart = null;
  }
  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: generateColors(labels.length)
      }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: $${formatMoney(ctx.parsed)}` } }
      }
    }
  });
}

function generateColors(n) {
  const out = [];
  for (let i=0;i<n;i++){
    const hue = Math.round((i * 360 / Math.max(1,n)) % 360);
    out.push(`hsl(${hue} 70% 55%)`);
  }
  return out;
}

function formatMoney(n){ return Number(Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2); }

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;', '<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function editBill(id) {
  const b = state.bills.find(x => x.id === id);
  if (!b) return;
  // prefill form for quick editing (we'll replace the bill on save)
  billName.value = b.name;
  billAmount.value = b.amount;
  billCategory.value = b.category;
  billDueDate.value = b.due || '';
  billRecurring.checked = !!b.recurring;

  // remove old bill
  state.bills = state.bills.filter(x => x.id !== id);
  saveState();
}
