from django.urls import path
from .views import (
    dashboard_stats, financial_summary, spending_analysis,
    budget_page, transaction_page, ai_insights_page,
    profile_page, user_logout, recurring_page,
    group_expenses_page, goals_page
)

urlpatterns = [
    path('', dashboard_stats, name='home'),
    path('dashboard/', financial_summary, name='dashboard'),
    path('dashboard-stats/', financial_summary, name='dashboard_stats'),
    path('financial-summary/', financial_summary, name='financial_summary'),
    path('spending-analysis/', spending_analysis, name='spending_analysis'),
    
    # Transaction Management (Screenshot URLs & legacy aliases)
    path('transaction/', transaction_page, name='transaction'),
    path('transactions/', transaction_page, name='transactions'),
    path('add-transaction/', transaction_page, name='add_transaction'),

    # Budget Management
    path('budget/', budget_page, name='budget'),
    path('set-budget/', budget_page, name='set_budget'),

    # Group Expenses
    path('group/', group_expenses_page, name='group'),
    path('group-expenses/', group_expenses_page, name='group_expenses'),

    # Savings Goals & AI Insights
    path('goals/', goals_page, name='goals'),
    path('ai-insights/', ai_insights_page, name='ai_insights'),

    # Recurring Payments
    path('recurring/', recurring_page, name='recurring'),

    # User Profile & Logout
    path('profile/', profile_page, name='profile'),
    path('logout/', user_logout, name='logout'),
]
