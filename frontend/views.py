from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Count, Avg, F
from datetime import datetime, timedelta
from users.models import User
from transactions.models import Transaction, Category
from group_expenses.models import Settlement
from insights.models import BudgetInsight, SavingsGoal
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.shortcuts import redirect
import json


def dashboard_stats(request):
    active_users = User.objects.filter(last_login__gte=datetime.now() - timedelta(days=30)).count()

    total_spending = BudgetInsight.objects.aggregate(Sum('average_spending'))['average_spending__sum'] or 1
    forecasted_spending = BudgetInsight.objects.aggregate(Sum('forecasted_spending'))['forecasted_spending__sum'] or 1
    accuracy_rate = round((forecasted_spending / total_spending) * 100, 2) if total_spending else 0

    total_settlements = Settlement.objects.filter(settled=True).count()
    total_transactions = Settlement.objects.count()
    support_availability = round((total_settlements / total_transactions) * 100, 2) if total_transactions else 0

    current_month = datetime.now().month
    monthly_savings = SavingsGoal.objects.filter(created_at__month=current_month).aggregate(Sum('saved_amount'))['saved_amount__sum'] or 0

    last_month_savings = SavingsGoal.objects.filter(created_at__month=current_month-1).aggregate(Sum('saved_amount'))['saved_amount__sum'] or 1
    savings_growth = round(((monthly_savings - last_month_savings) / last_month_savings) * 100, 2) if last_month_savings else 0

    investment_users = BudgetInsight.objects.values('user_id').distinct().count()
    investment_users_list = BudgetInsight.objects.values('user_id').distinct()[:5]  # Fetch 5 sample users

    average_roi = BudgetInsight.objects.aggregate(Avg('forecasted_spending'))['forecasted_spending__avg'] or 0

    context = {
        'active_users': active_users,
        'accuracy_rate': accuracy_rate,
        'support_availability': support_availability,
        'monthly_savings': monthly_savings,
        'savings_growth': savings_growth,
        'investment_users': investment_users,
        'investment_users_list': investment_users_list,
        'average_roi': average_roi,
    }

    return render(request, 'frontend/homepage.html', context)


@login_required
def financial_summary(request):
    user = request.user  

    today = datetime.today()
    current_month = today.month
    current_year = today.year
    first_of_this_month = today.replace(day=1)
    last_day_prev_month = first_of_this_month - timedelta(days=1)
    prev_month = last_day_prev_month.month
    prev_month_year = last_day_prev_month.year

    # Correct transaction queries based on category_type (positive amounts)
    user_txs = Transaction.objects.filter(user=user)

    total_income = float(user_txs.filter(category_type='income').aggregate(Sum('amount'))['amount__sum'] or 0)
    total_expenses = float(user_txs.filter(category_type='expense').aggregate(Sum('amount'))['amount__sum'] or 0)
    total_balance = total_income - total_expenses

    monthly_income = float(user_txs.filter(category_type='income', date__month=current_month, date__year=current_year).aggregate(Sum('amount'))['amount__sum'] or 0)
    monthly_expenses = float(user_txs.filter(category_type='expense', date__month=current_month, date__year=current_year).aggregate(Sum('amount'))['amount__sum'] or 0)

    last_month_income = float(user_txs.filter(category_type='income', date__month=prev_month, date__year=prev_month_year).aggregate(Sum('amount'))['amount__sum'] or 0)
    last_month_expenses = float(user_txs.filter(category_type='expense', date__month=prev_month, date__year=prev_month_year).aggregate(Sum('amount'))['amount__sum'] or 0)
    last_month_balance = last_month_income - last_month_expenses

    # Percentage changes without division by zero
    if last_month_balance != 0:
        balance_change = round(((total_balance - last_month_balance) / abs(last_month_balance)) * 100, 1)
    else:
        balance_change = 0.0

    if last_month_income > 0:
        income_change = round(((monthly_income - last_month_income) / last_month_income) * 100, 1)
    else:
        income_change = 0.0

    if last_month_expenses > 0:
        expense_change = round(((monthly_expenses - last_month_expenses) / last_month_expenses) * 100, 1)
    else:
        expense_change = 0.0

    total_goal = float(SavingsGoal.objects.filter(user=user).aggregate(Sum('target_amount'))['target_amount__sum'] or 0)
    total_savings = float(SavingsGoal.objects.filter(user=user).aggregate(Sum('saved_amount'))['saved_amount__sum'] or 0)
    savings_progress = round((total_savings / total_goal) * 100, 1) if total_goal > 0 else 0.0

    # Prepare initial spending data for embedding
    start_date = today.date().replace(day=1)
    month_txs = user_txs.filter(date__gte=start_date)
    date_map = {}
    for t in month_txs:
        d_str = t.date.strftime('%Y-%m-%d')
        if d_str not in date_map:
            date_map[d_str] = {'income': 0.0, 'expense': 0.0}
        amt = float(t.amount or 0)
        if t.category_type == 'income':
            date_map[d_str]['income'] += amt
        else:
            date_map[d_str]['expense'] += amt

    sorted_dates = sorted(date_map.keys())
    spending_data = {
        "dates": sorted_dates,
        "income": [date_map[d]['income'] for d in sorted_dates],
        "expenses": [date_map[d]['expense'] for d in sorted_dates],
        "expense_categories": [],
        "months": [today.strftime("%b %Y")],
        "monthly_expenses": [monthly_expenses],
    }

    context = {
        'total_balance': f"{total_balance:,.2f}",
        'balance_change': balance_change,
        'monthly_income': f"{monthly_income:,.2f}",
        'income_change': income_change,
        'monthly_expenses': f"{monthly_expenses:,.2f}",
        'expense_change': expense_change,
        'savings_progress': savings_progress,
        'spending_data': json.dumps(spending_data),
    }

    return render(request, 'frontend/dashboard.html', context)


@login_required
def spending_analysis(request):
    user_id = request.user.id
    period = request.GET.get('period', 'month')

    today = datetime.today().date()
    if period == 'week':
        start_date = today - timedelta(days=today.weekday())
    elif period == 'year':
        start_date = today.replace(month=1, day=1)
    else:  # Default to month
        start_date = today.replace(day=1)

    transactions = Transaction.objects.filter(user_id=user_id, date__gte=start_date).order_by('date')

    # Build common date series for both income and expense
    date_map = {}
    for t in transactions:
        d_str = t.date.strftime('%Y-%m-%d')
        if d_str not in date_map:
            date_map[d_str] = {'income': 0.0, 'expense': 0.0}
        amt = float(t.amount or 0)
        if t.category_type == "income":
            date_map[d_str]['income'] += amt
        else:
            date_map[d_str]['expense'] += amt

    sorted_dates = sorted(date_map.keys())
    dates = sorted_dates
    income = [date_map[d]['income'] for d in sorted_dates]
    expenses = [date_map[d]['expense'] for d in sorted_dates]

    # Category breakdown for expenses
    expense_txs = transactions.filter(category_type="expense")
    category_map = {}
    for t in expense_txs:
        c_name = t.category.name if t.category else "Other"
        category_map[c_name] = category_map.get(c_name, 0.0) + float(t.amount or 0)

    category_data = [
        {"category": cat, "amount": amt}
        for cat, amt in category_map.items()
    ]

    # Monthly expense trend (database-agnostic, works on SQLite and PostgreSQL)
    monthly_map = {}
    for t in expense_txs:
        m_str = t.date.strftime("%b %Y")
        monthly_map[m_str] = monthly_map.get(m_str, 0.0) + float(t.amount or 0)

    months = list(monthly_map.keys())
    monthly_totals = list(monthly_map.values())

    context = {
        "dates": dates,
        "income": income,
        "expenses": expenses,
        "expense_categories": category_data,
        "months": months,
        "monthly_expenses": monthly_totals,
    }

    return JsonResponse(context)


@login_required
def budget_page(request):
    """Page view for /set-budget"""
    return render(request, 'frontend/budget.html')


@login_required
def transaction_page(request):
    """Page view for /add-transaction"""
    return render(request, 'frontend/transaction.html')


@login_required
def ai_insights_page(request):
    """Page view for /ai-insights"""
    return render(request, 'frontend/goals.html')


@login_required
def profile_page(request):
    """Page view for /profile"""
    return render(request, 'frontend/profile.html', {'user': request.user})


@login_required
def recurring_page(request):
    """Page view for /recurring/"""
    return render(request, 'frontend/recurring.html')


@login_required
def group_expenses_page(request):
    """Page view for /group/"""
    return render(request, 'frontend/group_expenses.html')


@login_required
def goals_page(request):
    """Page view for /goals/"""
    return render(request, 'frontend/goals.html')


def user_logout(request):
    """Logout handler for /logout"""
    logout(request)
    return redirect('login')



