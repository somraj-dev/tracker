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

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("budgetModal");
    const openBtn = document.getElementById("addBudgetModalBtn");
    const closeBtn = document.getElementById("closeBudgetModal");
    const form = document.getElementById("budgetForm");

    if (openBtn && modal) {
        openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const category = document.getElementById("budgetCategory")?.value;
            const limit = parseFloat(document.getElementById("budgetLimit")?.value || 0);

            if (!category || isNaN(limit) || limit <= 0) {
                alert("Please specify a valid category and budget limit.");
                return;
            }

            try {
                const response = await fetch("/api/budgets/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie('csrftoken') || ''
                    },
                    body: JSON.stringify({
                        category: category,
                        monthly_limit: limit
                    })
                });

                if (!response.ok) {
                    const err = await response.json();
                    alert("Error saving budget: " + JSON.stringify(err));
                    return;
                }

                alert("Budget set successfully!");
                if (modal) modal.classList.add("hidden");
                form.reset();
                fetchBudgetData();
            } catch (err) {
                console.error("Budget save error:", err);
                alert("Failed to save budget.");
            }
        });
    }

    fetchBudgetData();
    fetchBudgetInsights();
});

async function fetchBudgetData() {
    const budgetList = document.getElementById("budgetList");
    const countElem = document.getElementById("activeBudgetsCount");
    const totalElem = document.getElementById("totalBudgetValue");

    try {
        const response = await fetch("/api/budgets/");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const budgets = Array.isArray(data) ? data : (data.results || []);

        if (countElem) countElem.textContent = budgets.length;

        let totalLimit = 0;
        budgets.forEach(b => {
            totalLimit += parseFloat(b.monthly_limit || 0);
        });

        if (totalElem) {
            totalElem.textContent = `₹${totalLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        }

        if (!budgetList) return;

        if (budgets.length === 0) {
            budgetList.innerHTML = `
                <div class="col-span-full p-8 text-center text-gray-400 bg-gray-50 rounded-xl">
                    <i class="ri-pie-chart-line text-3xl mb-2 text-gray-300 block"></i>
                    <p class="font-medium text-gray-700">No category budgets defined</p>
                    <p class="text-xs text-gray-400 mt-1">Click 'Set New Budget' above to allocate limits.</p>
                </div>
            `;
            return;
        }

        budgetList.innerHTML = budgets.map(b => {
            const limit = parseFloat(b.monthly_limit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            return `
                <div class="p-4 bg-gray-50 border border-gray-100 rounded-xl hover:shadow-sm transition">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-bold text-gray-900">${b.category}</span>
                        <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Monthly</span>
                    </div>
                    <p class="text-2xl font-extrabold text-blue-600">₹${limit}</p>
                    <p class="text-xs text-gray-400 mt-2">Created: ${b.created_at ? new Date(b.created_at).toLocaleDateString() : 'Active'}</p>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading budgets:", err);
        if (budgetList) {
            budgetList.innerHTML = `<div class="col-span-full text-center py-6 text-gray-400">Failed to load budgets.</div>`;
        }
    }
}

async function fetchBudgetInsights() {
    const warningsContainer = document.getElementById("budgetWarningsContainer");
    const warningsElem = document.getElementById("budgetWarnings");
    const healthElem = document.getElementById("budgetHealthStatus");

    try {
        const response = await fetch('/api/ai-insights/');
        if (!response.ok) return;
        const data = await response.json();
        const insights = Array.isArray(data) ? data : (data.results || []);

        if (!warningsContainer || !warningsElem) return;

        if (insights.length > 0) {
            warningsContainer.classList.remove("hidden");
            warningsElem.innerHTML = insights.map(i => `
                <div class="flex items-center justify-between py-1">
                    <span>${i.message}</span>
                    ${i.suggested_budget ? `<span class="font-semibold ml-2">Limit: ₹${i.suggested_budget}</span>` : ''}
                </div>
            `).join('');
            if (healthElem) {
                healthElem.textContent = "Attention Needed";
                healthElem.className = "text-xl font-bold text-amber-600";
            }
        } else {
            warningsContainer.classList.add("hidden");
            if (healthElem) {
                healthElem.textContent = "On Track";
                healthElem.className = "text-xl font-bold text-emerald-600";
            }
        }
    } catch (err) {
        console.error("Error loading insights in budget view:", err);
    }
}