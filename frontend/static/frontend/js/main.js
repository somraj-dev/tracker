// Helper: Get CSRF Token from Cookies for Django POST requests
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

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Quick Actions & Voice Modal
    const voiceEntryBtn = document.getElementById('voiceEntryBtn');
    const transactionModal = document.getElementById('transactionModal');
    const editAmount = document.getElementById('editAmount');
    const editCategory = document.getElementById('editCategory');
    const editType = document.getElementById('editType');
    const saveTransactionBtn = document.getElementById('saveTransaction');
    const cancelTransactionBtn = document.getElementById('cancelTransaction');

    // Speech Recognition
    if (voiceEntryBtn && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        voiceEntryBtn.addEventListener('click', () => {
            try {
                recognition.start();
                alert("Listening... Speak your transaction details (e.g. 'Spent 250 on coffee').");
            } catch (err) {
                console.warn("Speech recognition already active or error:", err);
            }
        });

        recognition.onresult = async (event) => {
            const voiceText = event.results[0][0].transcript;
            console.log("Voice Input:", voiceText);

            const origContent = voiceEntryBtn.innerHTML;
            voiceEntryBtn.innerHTML = '<span class="text-xs font-semibold text-blue-700">Processing...</span>';
            voiceEntryBtn.disabled = true;

            try {
                const response = await fetch('/api/process-voice/', {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie('csrftoken') || ''
                    },
                    body: JSON.stringify({ voice_text: voiceText })
                });

                if (!response.ok) {
                    throw new Error(`Voice process failed with HTTP ${response.status}`);
                }

                const data = await response.json();

                if (data.error) {
                    alert("Error: " + data.error);
                } else if (transactionModal && editAmount && editCategory && editType) {
                    editAmount.value = data.amount || '';
                    editCategory.value = data.category || '';
                    editType.value = data.transaction_type || 'expense';
                    transactionModal.classList.remove('hidden');
                }
            } catch (err) {
                console.error("Error processing voice input:", err);
                alert("Failed to process voice entry. Please add manually.");
            } finally {
                voiceEntryBtn.innerHTML = origContent;
                voiceEntryBtn.disabled = false;
            }
        };

        recognition.onerror = (event) => {
            console.error("Voice recognition error:", event.error);
            alert("Voice recognition error: " + event.error);
        };
    } else if (voiceEntryBtn) {
        voiceEntryBtn.addEventListener('click', () => {
            alert("Speech recognition is not supported in this browser. Please use the Add Transaction button.");
        });
    }

    // Modal Action Handlers
    if (saveTransactionBtn && editAmount && editCategory && editType) {
        saveTransactionBtn.addEventListener('click', async () => {
            const amountVal = parseFloat(editAmount.value);
            if (isNaN(amountVal) || amountVal <= 0) {
                alert("Please enter a valid amount.");
                return;
            }

            const transactionData = {
                amount: amountVal,
                transaction_type: editType.value,
                category: editCategory.value || 'General'
            };

            try {
                const response = await fetch('/api/confirm-transaction/', {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCookie('csrftoken') || ''
                    },
                    body: JSON.stringify(transactionData)
                });

                if (!response.ok) {
                    throw new Error(`Server returned HTTP ${response.status}`);
                }

                const result = await response.json();
                if (result.message) {
                    alert("Transaction saved successfully!");
                    if (transactionModal) transactionModal.classList.add('hidden');
                    fetchTransactions();
                } else {
                    alert(result.error || "Error saving transaction.");
                }
            } catch (err) {
                console.error("Error saving transaction:", err);
                alert("Error saving transaction. Check your connection.");
            }
        });
    }

    if (cancelTransactionBtn && transactionModal) {
        cancelTransactionBtn.addEventListener('click', () => {
            transactionModal.classList.add('hidden');
        });
    }

    // User Dropdown & Profile
    const userDropdownBtn = document.getElementById('userDropdownBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdownBtn && userDropdown) {
        userDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target) && !userDropdownBtn.contains(e.target)) {
                userDropdown.classList.add('hidden');
            }
        });
    }

    // Notifications Dropdown
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.classList.toggle('hidden');
            fetchUserNotifications();
        });

        document.addEventListener('click', (e) => {
            if (!notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
                notificationDropdown.classList.add('hidden');
            }
        });
    }

    // Populate Current Date
    const currentDateElem = document.getElementById('currentDate');
    if (currentDateElem) {
        currentDateElem.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    // Fetch User Profile
    async function fetchUserProfile() {
        try {
            const response = await fetch('/api/user-profile/');
            if (!response.ok) return;
            const data = await response.json();
            const avatarElem = document.getElementById('userAvatar');
            if (avatarElem && data.avatar) avatarElem.src = data.avatar;
            const welcomeMsg = document.getElementById('welcomeMessage');
            if (welcomeMsg && data.username) welcomeMsg.textContent = `Welcome back, ${data.username}`;
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    }

    // ECharts Setup with Fallbacks
    let spendingChart = null;
    let expensePieChart = null;
    let expenseBarChart = null;

    if (typeof echarts !== 'undefined') {
        const spendingChartElem = document.getElementById('spendingChart');
        if (spendingChartElem) spendingChart = echarts.init(spendingChartElem);

        const expensePieElem = document.getElementById('expensePieChart');
        if (expensePieElem) expensePieChart = echarts.init(expensePieElem);

        const expenseBarElem = document.getElementById('expenseBarChart');
        if (expenseBarElem) expenseBarChart = echarts.init(expenseBarElem);

        window.addEventListener('resize', () => {
            if (spendingChart) spendingChart.resize();
            if (expensePieChart) expensePieChart.resize();
            if (expenseBarChart) expenseBarChart.resize();
        });
    } else {
        console.warn('ECharts library unavailable; graphical charts will not be rendered.');
    }

    function updateCharts(data) {
        if (!data || typeof echarts === 'undefined') return;

        if (spendingChart) {
            spendingChart.setOption({
                tooltip: { trigger: 'axis' },
                legend: { data: ['Income', 'Expenses'], top: 0 },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'category', data: data.dates || [] },
                yAxis: { type: 'value' },
                series: [
                    { name: 'Income', type: 'line', data: data.income || [], smooth: true, itemStyle: { color: '#10B981' } },
                    { name: 'Expenses', type: 'line', data: data.expenses || [], smooth: true, itemStyle: { color: '#EF4444' } }
                ]
            });
        }

        if (expensePieChart) {
            const pieData = (data.expense_categories || []).map(item => ({
                name: item.category,
                value: item.amount
            }));
            expensePieChart.setOption({
                tooltip: { trigger: 'item', formatter: '{b}: ₹{c} ({d}%)' },
                legend: { bottom: 0, left: 'center' },
                series: [{
                    name: 'Expenses by Category',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    data: pieData.length > 0 ? pieData : [{ name: 'No Expenses Recorded', value: 0 }]
                }]
            });
        }

        if (expenseBarChart) {
            expenseBarChart.setOption({
                tooltip: { trigger: 'axis' },
                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                xAxis: { type: 'category', data: data.months || [] },
                yAxis: { type: 'value' },
                series: [{
                    name: 'Monthly Expenses',
                    type: 'bar',
                    data: data.monthly_expenses || [],
                    itemStyle: { color: '#6366F1', borderRadius: [4, 4, 0, 0] }
                }]
            });
        }
    }

    // Initialize Charts from Embedded JSON
    const initialDataElem = document.getElementById('initialSpendingData');
    let initialSpendingData = { dates: [], income: [], expenses: [], expense_categories: [], months: [], monthly_expenses: [] };
    if (initialDataElem && initialDataElem.textContent.trim()) {
        try {
            initialSpendingData = JSON.parse(initialDataElem.textContent);
        } catch (e) {
            console.error('Error parsing initial spending data:', e);
        }
    }
    updateCharts(initialSpendingData);

    // Filter Buttons Handler
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-700');

            try {
                const response = await fetch(`/spending-analysis/?period=${btn.getAttribute('data-period')}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                updateCharts(data);
            } catch (err) {
                console.error("Failed to load filtered spending data:", err);
            }
        });
    });

    // Helper: Category Icon & Style Resolver
    function getCategoryMeta(categoryName, categoryType) {
        const cat = (categoryName || '').toLowerCase();
        if (categoryType === 'income') {
            return { icon: 'ri-arrow-up-circle-line', color: 'text-emerald-600', bg: 'bg-emerald-50' };
        }
        if (cat.includes('food') || cat.includes('restaurant') || cat.includes('dining')) {
            return { icon: 'ri-restaurant-line', color: 'text-amber-600', bg: 'bg-amber-50' };
        }
        if (cat.includes('grocer')) {
            return { icon: 'ri-store-2-line', color: 'text-lime-600', bg: 'bg-lime-50' };
        }
        if (cat.includes('transport') || cat.includes('travel') || cat.includes('fuel')) {
            return { icon: 'ri-car-line', color: 'text-orange-600', bg: 'bg-orange-50' };
        }
        if (cat.includes('util') || cat.includes('electric') || cat.includes('water')) {
            return { icon: 'ri-flashlight-line', color: 'text-yellow-600', bg: 'bg-yellow-50' };
        }
        if (cat.includes('health') || cat.includes('med')) {
            return { icon: 'ri-heart-pulse-line', color: 'text-rose-600', bg: 'bg-rose-50' };
        }
        if (cat.includes('subscript') || cat.includes('netflix') || cat.includes('spotify')) {
            return { icon: 'ri-tv-line', color: 'text-purple-600', bg: 'bg-purple-50' };
        }
        if (cat.includes('shop')) {
            return { icon: 'ri-shopping-bag-3-line', color: 'text-blue-600', bg: 'bg-blue-50' };
        }
        return { icon: 'ri-money-dollar-circle-line', color: 'text-gray-600', bg: 'bg-gray-100' };
    }

    // Fetch Recent Transactions
    async function fetchTransactions() {
        const transactionList = document.getElementById('transactionList');
        if (!transactionList) return;

        try {
            const response = await fetch('/api/transactions/');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const transactions = Array.isArray(data) ? data : (data.results || []);

            transactionList.innerHTML = '';
            if (transactions.length === 0) {
                transactionList.innerHTML = `
                    <div class="p-8 text-center text-gray-500 bg-gray-50 rounded-xl">
                        <i class="ri-inbox-2-line text-3xl mb-2 text-gray-400 block"></i>
                        <p class="font-medium text-gray-700">No transactions yet</p>
                        <p class="text-xs text-gray-400 mt-1">Add your first transaction using Quick Actions above.</p>
                    </div>
                `;
                return;
            }

            transactions.slice(0, 8).forEach(tx => {
                const isIncome = (tx.category_type === 'income');
                const meta = getCategoryMeta(tx.category_name, tx.category_type);
                const amountNum = parseFloat(tx.amount || 0);
                const formattedAmount = `₹${amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                const sign = isIncome ? '+' : '-';
                const amountColor = isIncome ? 'text-emerald-600' : 'text-rose-600';
                const dateStr = tx.date ? new Date(tx.date).toLocaleDateString() : '';

                transactionList.innerHTML += `
                    <div class="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/70 rounded-xl transition">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 ${meta.bg} ${meta.color} rounded-xl flex items-center justify-center">
                                <i class="${meta.icon} text-lg"></i>
                            </div>
                            <div>
                                <p class="font-semibold text-gray-800 text-sm">${tx.description || tx.category_name}</p>
                                <p class="text-xs text-gray-400">${tx.category_name || 'General'} &bull; ${dateStr}</p>
                            </div>
                        </div>
                        <p class="font-bold text-sm ${amountColor}">${sign}${formattedAmount}</p>
                    </div>
                `;
            });
        } catch (error) {
            console.error('Error fetching transactions:', error);
            transactionList.innerHTML = `
                <div class="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-xl">
                    Unable to load transactions right now.
                </div>
            `;
        }
    }

    // Fetch AI Insights
    async function fetchAIInsights() {
        const aiBox = document.getElementById('aiInsightsBox');
        if (!aiBox) return;

        try {
            const response = await fetch('/api/ai-insights/');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const insights = Array.isArray(data) ? data : (data.results || []);

            aiBox.innerHTML = '';
            if (insights.length === 0) {
                aiBox.innerHTML = `
                    <div class="p-6 text-center text-gray-500 bg-gray-50 rounded-xl">
                        <i class="ri-sparkling-line text-2xl text-purple-400 mb-1 block"></i>
                        <p class="text-sm font-medium text-gray-700">All budgets on track</p>
                        <p class="text-xs text-gray-400 mt-1">Keep adding transactions for smart spending recommendations.</p>
                    </div>
                `;
                return;
            }

            insights.forEach(insight => {
                aiBox.innerHTML += `
                    <div class="p-4 bg-purple-50/60 border border-purple-100 rounded-xl mb-3 last:mb-0">
                        <div class="flex items-center justify-between mb-1">
                            <p class="font-semibold text-gray-900 text-sm flex items-center">
                                <i class="ri-lightbulb-flash-line text-purple-600 mr-1.5"></i>
                                ${insight.title}
                            </p>
                        </div>
                        <p class="text-xs text-gray-600 mb-3">${insight.message}</p>
                        ${insight.suggested_budget ? `
                            <button class="acceptBudgetBtn text-xs font-semibold text-purple-700 bg-white border border-purple-200 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-lg transition shadow-sm"
                                data-category="${insight.category || ''}"
                                data-budget="${insight.suggested_budget}">
                                Accept Suggested Budget (₹${insight.suggested_budget})
                            </button>
                        ` : ''}
                    </div>
                `;
            });

            document.querySelectorAll('.acceptBudgetBtn').forEach(btn => {
                btn.addEventListener('click', async function () {
                    const category = this.getAttribute('data-category');
                    const newLimit = this.getAttribute('data-budget');
                    try {
                        const res = await fetch('/api/accept-suggested-budget/', {
                            method: 'POST',
                            headers: {
                                "Content-Type": "application/json",
                                "X-CSRFToken": getCookie('csrftoken') || ''
                            },
                            body: JSON.stringify({ category, new_limit: newLimit })
                        });
                        const resData = await res.json();
                        alert(resData.message || "Budget updated successfully!");
                        fetchAIInsights();
                    } catch (err) {
                        console.error("Failed to accept suggested budget:", err);
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching AI insights:', error);
            aiBox.innerHTML = `
                <div class="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
                    Smart recommendations are currently synchronizing.
                </div>
            `;
        }
    }

    // Fetch Upcoming Bills
    async function fetchUpcomingBills() {
        const billsList = document.getElementById('billsList');
        if (!billsList) return;

        try {
            const response = await fetch('/api/upcoming-bills/');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const bills = Array.isArray(data) ? data : (data.results || []);

            billsList.innerHTML = '';
            if (bills.length === 0) {
                billsList.innerHTML = `
                    <div class="p-8 text-center text-gray-500 bg-gray-50 rounded-xl">
                        <i class="ri-calendar-check-line text-3xl mb-2 text-gray-400 block"></i>
                        <p class="font-medium text-gray-700">No upcoming bills</p>
                        <p class="text-xs text-gray-400 mt-1">You are all caught up on scheduled payments.</p>
                    </div>
                `;
                return;
            }

            bills.forEach(bill => {
                const daysRemaining = bill.days_remaining ?? 0;
                const isUrgent = daysRemaining <= 7;
                const textColor = isUrgent ? "text-rose-600" : "text-gray-900";
                const amount = parseFloat(bill.amount || 0);
                const formattedAmount = `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

                billsList.innerHTML += `
                    <div class="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/70 rounded-xl transition">
                        <div>
                            <p class="font-semibold ${textColor} text-sm">${bill.name} <span class="text-xs text-gray-400 font-normal">(${bill.category || 'General'})</span></p>
                            <p class="text-xs text-gray-500">${bill.frequency || 'Monthly'} &bull; Due in ${daysRemaining} days (${bill.next_payment_date || ''})</p>
                        </div>
                        <p class="font-bold text-sm ${textColor}">${formattedAmount}</p>
                    </div>
                `;
            });
        } catch (error) {
            console.error('Error fetching upcoming bills:', error);
            billsList.innerHTML = `
                <div class="p-4 text-center text-sm text-gray-500 bg-gray-50 rounded-xl">
                    Unable to load upcoming bills.
                </div>
            `;
        }
    }

    // Fetch User Notifications
    async function fetchUserNotifications() {
        const notificationList = document.getElementById('notificationList');
        const notificationBadge = document.getElementById('notificationBadge');
        if (!notificationList) return;

        try {
            const response = await fetch('/api/user-notifications/');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const notifications = Array.isArray(data) ? data : (data.results || []);

            notificationList.innerHTML = '';
            if (notifications.length > 0) {
                if (notificationBadge) notificationBadge.classList.remove('hidden');
                notifications.forEach(n => {
                    notificationList.innerHTML += `
                        <div class="p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded-lg">
                            <p class="font-semibold text-gray-800 text-xs">${n.title || 'Notification'}</p>
                            <p class="text-xs text-gray-600 mt-0.5">${n.message || ''}</p>
                            <p class="text-[10px] text-gray-400 mt-1">${n.timestamp || ''}</p>
                        </div>
                    `;
                });
            } else {
                if (notificationBadge) notificationBadge.classList.add('hidden');
                notificationList.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">No new notifications.</p>`;
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            if (notificationList) {
                notificationList.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Notifications offline.</p>`;
            }
        }
    }

    // Initial API Invocations
    fetchUserProfile();
    fetchTransactions();
    fetchAIInsights();
    fetchUpcomingBills();
    fetchUserNotifications();
});