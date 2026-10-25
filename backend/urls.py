from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static

# Direct imports for frontend API contracts
from transactions.views import (
    TransactionListCreateView, upcoming_bills,
    process_voice_entry, confirm_voice_transaction,
    CategoryListView, BudgetView, export_transactions_csv
)
from insights.views import ai_insights, accept_suggested_budget

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT Authentication Routes
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Direct API endpoints matching frontend main.js expectations
    path('api/transactions/', TransactionListCreateView.as_view(), name='api_transactions'),
    path('api/categories/', CategoryListView.as_view(), name='api_categories'),
    path('api/budgets/', BudgetView.as_view(), name='api_budgets'),
    path('api/export-transactions/', export_transactions_csv, name='api_export_transactions'),
    path('api/upcoming-bills/', upcoming_bills, name='api_upcoming_bills'),
    path('api/process-voice/', process_voice_entry, name='api_process_voice'),
    path('api/confirm-transaction/', confirm_voice_transaction, name='api_confirm_transaction'),
    path('api/ai-insights/', ai_insights, name='api_ai_insights'),
    path('api/accept-suggested-budget/', accept_suggested_budget, name='api_accept_suggested_budget'),

    # Redirect legacy/HTML file requests to unified route
    path('dashboard.html', RedirectView.as_view(url='/dashboard/', permanent=False)),

    # Users & Auth Routes
    path('', include('users.urls')),

    # Frontend pages (/dashboard/, /set-budget/, /add-transaction/, /ai-insights/, /profile/, /logout/)
    path('', include('frontend.urls')),

    # Group Expenses API Routes
    path('api/group-expenses/', include('group_expenses.urls')),

    # Transactions, Payments, Insights, Admin Dashboard modular apps
    path('api/transactions-app/', include('transactions.urls')),
    path('api/payments/', include('payments.urls')),
    path('insights/', include('insights.urls')),
    path('admin_dashboard/', include('admin_dashboard.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
