// Helper: Get CSRF Token
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

let transactionsCache = [];
let trendChart = null;

document.addEventListener("DOMContentLoaded", () => {
    // Initialize chart if element & library exist
    const chartElem = document.getElementById("chartContainer");
    if (chartElem && typeof echarts !== 'undefined') {
        trendChart = echarts.init(chartElem);
        window.addEventListener('resize', () => {
            if (trendChart) trendChart.resize();
        });
    }

    // Modal controls
    const addBtn = document.getElementById("addTransactionBtn");
    const modal = document.getElementById("addTransactionModal");
    const closeBtn = document.getElementById("closeModal");

    if (addBtn && modal) {
        addBtn.addEventListener("click", () => modal.classList.remove("hidden"));
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    }

    // Set default date in modal to today
    const dateInput = document.getElementById("transactionDate");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Export CSV Button
    const exportBtn = document.getElementById("exportCsvBtn");
    if (exportBtn) {
        exportBtn.addEventListener("click", async () => {
            try {
                const response = await fetch("/api/export-transactions/", {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": getCookie('csrftoken') || ''
                    }
                });
                if (!response.ok) throw new Error("Failed to export CSV");
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'transactions.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } catch (err) {
                console.error("CSV Export failed:", err);
                alert("Failed to export transactions CSV.");
            }
        });
    }

    // Apply Filter Button
    const filterBtn = document.getElementById("applyFiltersBtn");
    if (filterBtn) {
        filterBtn.addEventListener("click", () => fetchTransactions());
    }

    // Form submit handler
    const form = document.getElementById("transactionForm");
    if (form) {
        form.addEventListener("submit", async function(event) {
            event.preventDefault();
            const dateVal = document.getElementById("transactionDate")?.value;
            const catVal = document.getElementById("transactionCategory")?.value;
            const typeVal = document.getElementById("transactionType")?.value || 'expense';
            const amountVal = parseFloat(document.getElementById("transactionAmount")?.value || 0);
            const descVal = document.getElementById("transactionDescription")?.value || '';

            if (isNaN(amountVal) || amountVal <= 0) {
                alert("Please enter a valid amount.");
                return;
            }

            const payload = {
                date: dateVal || new Date().toISOString().split('T')[0],
                category_id: catVal ? parseInt(catVal) : null,
                category_type: typeVal,
                amount: amountVal,
                currency: "INR",
                description: descVal
            };

            try {
                const response = await fetch("/api/transactions/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie('csrftoken') || ''
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errData = await response.json();
                    alert("Error creating transaction: " + JSON.stringify(errData));
                    return;
                }

                alert("Transaction added successfully!");
                if (modal) modal.classList.add("hidden");
                form.reset();
                if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
                fetchTransactions();
            } catch (error) {
                console.error("Error adding transaction:", error);
                alert("Network error adding transaction.");
            }
        });
    }

    // Fetch initial datasets
    fetchCategories();
    fetchTransactions();
});

async function fetchCategories() {
    try {
        const response = await fetch("/api/categories/");
        if (!response.ok) return;
        const data = await response.json();
        const categories = Array.isArray(data) ? data : (data.results || []);

        const filterSelect = document.getElementById("filterCategory");
        const formSelect = document.getElementById("transactionCategory");

        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">All Categories</option>';
            categories.forEach(c => {
                filterSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }

        if (formSelect) {
            formSelect.innerHTML = '';
            if (categories.length === 0) {
                formSelect.innerHTML = '<option value="">General</option>';
            } else {
                categories.forEach(c => {
                    formSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                });
            }
        }
    } catch (err) {
        console.error("Error fetching categories:", err);
    }
}

async function fetchTransactions() {
    const filterDate = document.getElementById("filterDate")?.value;
    const filterCat = document.getElementById("filterCategory")?.value;
    const filterAmt = document.getElementById("filterAmount")?.value;
    const searchVal = document.getElementById("searchText")?.value;

    let url = "/api/transactions/?";
    if (filterDate) url += `date=${encodeURIComponent(filterDate)}&`;
    if (filterCat) url += `category=${encodeURIComponent(filterCat)}&`;
    if (filterAmt) url += `min_amount=${encodeURIComponent(filterAmt)}&`;
    if (searchVal) url += `search=${encodeURIComponent(searchVal)}&`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.results || []);
        transactionsCache = list;
        renderTransactions(list);
        renderTrendChart(list);
    } catch (error) {
        console.error("Error fetching transactions:", error);
        const tbody = document.getElementById("transactionsList");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400">Failed to load transactions.</td></tr>`;
        }
    }
}

function renderTransactions(transactions) {
    const tbody = document.getElementById("transactionsList");
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400 font-medium">No transactions found matching your criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        const isIncome = (t.category_type === 'income');
        const colorClass = isIncome ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold';
        const sign = isIncome ? '+' : '-';
        const amt = parseFloat(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const typeBadge = isIncome
            ? '<span class="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 font-medium">Income</span>'
            : '<span class="px-2 py-0.5 rounded text-xs bg-rose-50 text-rose-700 font-medium">Expense</span>';

        return `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="py-3 px-4 text-gray-700">${t.date || 'N/A'}</td>
                <td class="py-3 px-4">${typeBadge}</td>
                <td class="py-3 px-4 font-medium text-gray-800">${t.category_name || 'General'}</td>
                <td class="py-3 px-4 text-right ${colorClass}">${sign}₹${amt}</td>
                <td class="py-3 px-4 text-gray-500">${t.description || '-'}</td>
                <td class="py-3 px-4 text-center">
                    <button class="text-xs text-gray-400 hover:text-gray-600">Details</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderTrendChart(transactions) {
    if (!trendChart || typeof echarts === 'undefined') return;

    // Aggregate spending by date
    const dateMap = {};
    transactions.forEach(t => {
        const d = t.date;
        if (!d) return;
        if (!dateMap[d]) dateMap[d] = { income: 0, expense: 0 };
        const amt = parseFloat(t.amount || 0);
        if (t.category_type === 'income') {
            dateMap[d].income += amt;
        } else {
            dateMap[d].expense += amt;
        }
    });

    const dates = Object.keys(dateMap).sort();
    const incomeData = dates.map(d => dateMap[d].income);
    const expenseData = dates.map(d => dateMap[d].expense);

    trendChart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['Income', 'Expenses'] },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: dates },
        yAxis: { type: 'value' },
        series: [
            { name: 'Income', type: 'line', data: incomeData, smooth: true, itemStyle: { color: '#10B981' } },
            { name: 'Expenses', type: 'line', data: expenseData, smooth: true, itemStyle: { color: '#EF4444' } }
        ]
    });
}