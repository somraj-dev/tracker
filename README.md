# 🎓 AI-Powered Personal Finance Tracker

A smart, full-stack personal finance management platform combining voice input, automated categorization, predictive analytics, and proactive budgeting to help users manage their financial life effortlessly.

---

## 📘 Table of Contents
- [Project Overview](#-project-overview)
- [System Requirements & Runtime Dependencies](#-system-requirements--runtime-dependencies)
- [Clean Setup & Installation Guide](#-clean-setup--installation-guide)
- [Celery Worker & Windows Compatibility Guide](#-celery-worker--windows-compatibility-guide)
- [Repository & Application Architecture](#-repository--application-architecture)
- [Data Models & Accounting Conventions](#-data-models--accounting-conventions)
- [API Contracts & Endpoints](#-api-contracts--endpoints)
- [Frontend Workflow & Defensive Execution](#-frontend-workflow--defensive-execution)
- [Production Configuration & Security Checklist](#-production-configuration--security-checklist)

---

## 🌟 Project Overview
The **AI-Powered Personal Finance Tracker** is built with a **Django 5.1** backend and an interactive **Tailwind CSS + Vanilla JavaScript + ECharts** frontend. Key capabilities include:
- **Financial Analytics Dashboard**: Real-time balance calculations, monthly income, expense metrics, and savings progress with graceful empty-state handling.
- **Voice-Assisted Transaction Logging**: In-browser speech recognition and NLP entity extraction to quickly record transactions without tedious form entry.
- **Spending Analysis & Visual Trends**: Unified multi-period time-series graphs (Income vs. Expenses), category breakdown pie charts, and monthly trend bar charts.
- **AI Budget Recommendations**: Proactive alerts and suggestions generated based on historical spending patterns.
- **Upcoming Bills & Recurring Payments**: Scheduled payment tracking with Celery reminder workflows.
- **Group Expenses**: Split shared payments and calculate settlements across peers.

---

## 💻 System Requirements & Runtime Dependencies

| Runtime / Tool | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Python** | `3.11.x` or `3.12.x` | Backend runtime & ML libraries (Django, Scikit-learn, Celery) |
| **Node.js** | `18.x` or higher | Frontend workflow runner (`npm run dev:frontend`) |
| **Redis** | `5.0+` / `6.x` / `7.x` | Message broker for Celery background tasks & beat schedules |
| **Database** | SQLite (default dev) / PostgreSQL `14+` (prod) | Relational database persistence |
| **Operating Systems** | Windows 10/11, macOS, Linux | Cross-platform compatibility |

---

## ⚙️ Clean Setup & Installation Guide

Follow these steps to set up the project from a fresh checkout:

### 1. Clone the Repository
```bash
git clone https://github.com/somraj-dev/tracker.git
cd tracker
```

### 2. Set Up Python Virtual Environment
Use Python 3.11 or 3.12 to create an isolated virtual environment:
```bash
# On Windows (PowerShell / Command Prompt)
python -m venv .venv
.\.venv\Scripts\activate

# On macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
# Upgrade pip, setuptools, wheel
python -m pip install --upgrade pip setuptools wheel

# Install Python requirements
pip install -r requirements.txt

# Install Node dependencies (optional frontend tooling)
npm install
```

### 4. Configure Environment Variables
Copy the sample environment file to create your local `.env`:
```bash
# On Windows
copy .env.example .env

# On macOS / Linux
cp .env.example .env
```
Default configuration values work immediately with SQLite for local development.

### 5. Run Database Migrations
Initialize the database tables:
```bash
python manage.py migrate
```

*(Optional) Create an administrator superuser:*
```bash
python manage.py createsuperuser
```

### 6. Start the Redis Broker (For Celery Tasks)
Ensure Redis is running locally:
```bash
# If using native Redis or WSL on Windows:
redis-server

# If using Docker:
docker run -d -p 6379:6379 --name redis redis:alpine
```

### 7. Run Celery Worker & Beat (Optional for Background Jobs)
See the [Windows Compatibility Guide](#-celery-worker--windows-compatibility-guide) below for required Windows configuration.

### 8. Start the Django Development Server
You can launch the server using `npm` or standard `manage.py`:
```bash
# Using npm script:
npm run dev:frontend

# Or directly with Python:
python manage.py runserver
```

Open your browser at: **`http://127.0.0.1:8000/`** (or go directly to **`http://127.0.0.1:8000/login/`**).

---

## 🪟 Celery Worker & Windows Compatibility Guide

### The Issue on Windows
On Windows systems, Celery's default multiprocessing billiard pool encounters:
```
PermissionError: [WinError 5] Access is denied
```
when attempting to spawn child worker processes due to Windows process creation limitations.

### The Solution: Solo Pool
To run Celery reliably on Windows, launch the worker with `--pool=solo`:

```bash
# Windows-compatible Celery command:
celery -A celery_app worker --pool=solo --loglevel=info
```

On Linux or macOS, the default prefork pool operates normally:
```bash
# Linux / macOS Celery command:
celery -A celery_app worker --loglevel=info
```

To run scheduled reminders (Celery Beat):
```bash
celery -A celery_app beat --loglevel=info
```

---

## 📂 Repository & Application Architecture

```
tracker/
├── backend/                  # Core Django project package
│   ├── settings.py           # Environment-configured Django settings
│   ├── urls.py               # Main URL dispatcher & frontend API routing
│   ├── wsgi.py / asgi.py     # Application server entry points
├── celery_app.py             # Celery application initialization & schedules
├── users/                    # Custom User model, auth & profile management
│   ├── models.py             # User (UUID pk, email login), Profile, FinancialData
│   ├── views.py              # LoginView, SignupView, user_profile API
│   └── urls.py               # /login/, /signup/, /api/user-profile/
├── transactions/             # Transactions & Budget tracking
│   ├── models.py             # Transaction, Category, Budget, BudgetHistory
│   ├── views.py              # TransactionListCreateView, confirm_voice, export
│   ├── serializers.py        # TransactionSerializer, CategorySerializer, BudgetSerializer
│   └── nlp_processing.py     # Safe NLP extraction for voice entries
├── frontend/                 # Template views & dynamic dashboard orchestration
│   ├── views.py              # financial_summary, spending_analysis, profile_page
│   ├── urls.py               # /dashboard/, /set-budget/, /add-transaction/, /profile/
│   ├── templates/frontend/   # HTML templates (dashboard, budget, transaction, profile)
│   └── static/frontend/js/   # Defensive scripts (main.js, budget.js, transaction.js)
├── insights/                 # Smart budgeting & AI recommendation engine
│   ├── views.py              # ai_insights, accept_suggested_budget
├── payments/                 # Recurring payments & Razorpay integration
│   ├── models.py             # RecurringPayment, Payment
├── group_expenses/           # Shared expenses & group settlements
├── notifications/            # User notification management
├── admin_dashboard/          # Custom administrative analytics interface
├── .env.example              # Template environment variables
├── requirements.txt          # Python dependencies
└── package.json              # Development commands (dev:frontend, start)
```

---

## 📊 Data Models & Accounting Conventions

To eliminate ambiguity across forms, serializers, charts, and queries, the project adheres to a single standard accounting convention:

1. **Transaction Amount**: `amount` is **always stored as a positive decimal value** (`DecimalField(max_digits=10, decimal_places=2)`).
2. **Transaction Classification**: The `category_type` field explicitly designates whether the transaction is an `'income'` or `'expense'`.
3. **Balance Calculation**:
   $$\text{Total Balance} = \sum(\text{Income}) - \sum(\text{Expenses})$$
4. **Calculations & Aggregations**:
   - Queries must filter via `category_type='income'` and `category_type='expense'`, never by checking `amount > 0` or `amount < 0`.
   - Category breakdown pie charts summarize expense records where `category_type='expense'`.
   - Savings progress tracks:
     $$\text{Savings Progress (\%)} = \min\left(100, \max\left(0, \frac{\text{Total Balance}}{\text{Monthly Income}} \times 100\right)\right)$$

---

## 🔗 API Contracts & Endpoints

### Frontend UI Routes
| Route | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Landing / Homepage |
| `/login/` | `GET`, `POST` | User authentication form & submission |
| `/signup/` | `GET`, `POST` | New user registration form & submission |
| `/dashboard/` | `GET` | Financial summary dashboard with charts & widgets |
| `/set-budget/` | `GET` | Category budget management interface |
| `/add-transaction/`| `GET` | Transaction management & manual entry table |
| `/ai-insights/` | `GET` | AI financial goal tracking & insights view |
| `/profile/` | `GET` | User profile, subscription status, and details |
| `/logout/` | `GET` | Session termination redirecting to login |

### REST API Endpoints
All API endpoints support both Session-based cookie authentication and JWT `Authorization: Bearer <token>` headers.

| Endpoint | Method | Response / Payload |
| :--- | :--- | :--- |
| `/spending-analysis/?period=30d` | `GET` | `{ dates: [], income: [], expenses: [], expense_categories: [], months: [], monthly_expenses: [] }` |
| `/api/transactions/` | `GET` | Paginated: `{ count: N, results: [ { id, date, amount, category_name, category_type, description } ] }` |
| `/api/transactions/` | `POST` | `{ date, category_id, category_type, amount, currency, description }` |
| `/api/categories/` | `GET` | `[ { id: 1, name: "Groceries" }, ... ]` |
| `/api/budgets/` | `GET`, `POST` | Category budget list / creation (`{ category, monthly_limit }`) |
| `/api/upcoming-bills/` | `GET` | Scheduled bills with days remaining |
| `/api/process-voice/` | `POST` | `{ voice_text: "..." }` $\to$ `{ amount, category, transaction_type }` |
| `/api/confirm-transaction/` | `POST` | `{ amount, category, transaction_type }` $\to$ `{ message, transaction_id }` |
| `/api/ai-insights/` | `GET` | Recommendations list with suggested category limits |
| `/api/accept-suggested-budget/` | `POST` | `{ category, new_limit }` |
| `/api/user-profile/` | `GET` | `{ id, username, avatar }` |
| `/api/user-notifications/` | `GET` | User-scoped notification list |

---

## 🛡️ Frontend Workflow & Defensive Execution

1. **Defensive DOM Checks**: All event listeners and element updates in `main.js`, `transaction.js`, and `budget.js` check element existence before manipulation to avoid halting execution.
2. **Graceful CDN Fallback**: ECharts initialization is guarded by `typeof echarts !== 'undefined'`. If external CDN scripts fail or time out, remaining widgets and tables continue functioning seamlessly.
3. **Defensive API Invocations**: Fetch calls verify `if (!response.ok) throw new Error(...)` before parsing JSON to cleanly isolate HTTP error codes.
4. **Pagination Resilience**: JavaScript endpoints safely handle both unpaginated lists `[...]` and DRF pagination objects `{ results: [...] }`.
5. **Empty Database States**: When an account has zero transactions or budgets, the UI renders informative empty-state cards rather than broken charts or unhandled errors.

---

## 🔒 Production Configuration & Security Checklist

When deploying to production, review the following configurations:

1. **Secret Key**: Generate a cryptographically secure key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(50))"
   ```
   Set it via the `SECRET_KEY` environment variable.
2. **Debug Mode**: Ensure `DJANGO_DEBUG=False` in production environments.
3. **Allowed Hosts**: Set `ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com`.
4. **Database**: Set `USE_POSTGRES=True` and configure `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT`.
5. **Static Assets**:
   ```bash
   python manage.py collectstatic --noinput
   ```
   Configure Nginx or WhiteNoise to serve `staticfiles/`.
6. **HTTPS & Cookies**: In production, ensure `CSRF_COOKIE_SECURE = True` and `SESSION_COOKIE_SECURE = True`.
