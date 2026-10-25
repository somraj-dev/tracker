from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics, filters, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from django.utils.timezone import now
from django.http import JsonResponse, HttpResponse
from django.db.models import Sum
from datetime import timedelta
import csv
import requests

from .models import Transaction, Budget, BudgetHistory, Category
from .serializers import TransactionSerializer, BudgetSerializer, BudgetHistorySerializer, CategorySerializer
from .nlp_processing import process_voice_transaction
from payments.models import RecurringPayment
from users.models import Profile

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_voice_entry(request):
    """
    Processes voice input and returns structured transaction details for user confirmation.
    """
    voice_text = request.data.get("voice_text", "")
    if not voice_text:
        return Response({"error": "No voice input received"}, status=400)

    try:
        transaction_data = process_voice_transaction(voice_text)
        return Response(transaction_data)
    except Exception as e:
        return Response({"error": f"Failed to parse speech: {str(e)}"}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_voice_transaction(request):
    """
    Saves user-confirmed transaction to the database.
    """
    user = request.user
    amount = request.data.get("amount")
    category_type = request.data.get("transaction_type") or request.data.get("category_type") or "expense"
    category_name = request.data.get("category")

    if not amount:
        return Response({"error": "Missing transaction amount"}, status=400)

    category_obj = None
    if category_name:
        category_obj, _ = Category.objects.get_or_create(user=user, name=category_name)

    transaction = Transaction.objects.create(
        user=user,
        amount=amount,
        category_type=category_type,
        category=category_obj,
        date=now().date(),
        currency="INR"
    )

    return Response({"message": "Transaction saved successfully!", "transaction_id": transaction.id})


@api_view(['GET'])
def get_transactions(request):
    """
    Fetch recent transactions formatted for dashboard widgets.
    """
    user = request.user if request.user.is_authenticated else None
    qs = Transaction.objects.select_related('category')
    if user:
        qs = qs.filter(user=user)
    transactions = qs.order_by('-date')[:10]

    data = [
        {
            "id": t.id,
            "category_name": t.category.name if t.category else "General",
            "category_type": t.category_type,
            "description": t.description or "",
            "amount": float(t.amount),
            "date": t.date.isoformat() if t.date else "",
        }
        for t in transactions
    ]

    return JsonResponse(data, safe=False)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def upcoming_bills(request):
    """
    Fetch upcoming recurring payments for the user.
    """
    user = request.user
    today = now().date()
    upcoming_payments = RecurringPayment.objects.filter(
        user=user, 
        next_payment_date__gte=today,
        status="active"
    ).order_by('next_payment_date')

    bills_list = [
        {
            "id": payment.id,
            "name": payment.name,
            "amount": float(payment.amount),
            "category": payment.category,
            "frequency": payment.frequency,
            "days_remaining": (payment.next_payment_date - today).days,
            "next_payment_date": payment.next_payment_date.strftime("%Y-%m-%d")
        } for payment in upcoming_payments
    ]

    return Response(bills_list)


def track_budget_history(user):
    """
    Stores historical budget data and calculates suggested budget.
    """
    current_month = now().month
    current_year = now().year

    budgets = Budget.objects.filter(user=user)

    for budget in budgets:
        category = budget.category
        prev_limit = budget.monthly_limit

        last_month = (now() - timedelta(days=30)).month
        total_spent = Transaction.objects.filter(
            user=user, category__name=category, date__month=last_month
        ).aggregate(Sum('amount'))['amount__sum'] or 0

        suggested_limit = prev_limit
        if total_spent > prev_limit:
            suggested_limit = prev_limit * 1.1
        elif total_spent < (prev_limit * 0.7):
            suggested_limit = prev_limit * 0.9

        BudgetHistory.objects.update_or_create(
            user=user,
            category=category,
            month=current_month,
            year=current_year,
            defaults={
                "previous_limit": prev_limit,
                "actual_spent": total_spent,
                "suggested_limit": suggested_limit,
            }
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_transactions_csv(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="transactions.csv"'

    writer = csv.writer(response)
    writer.writerow(['ID', 'Date', 'Category', 'Amount', 'Description'])

    transactions = Transaction.objects.filter(user=request.user).values_list('id', 'date', 'category__name', 'amount', 'description')
    for transaction in transactions:
        writer.writerow(transaction)

    return response


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['description']
    ordering_fields = ['date', 'amount']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Transaction.objects.filter(user=user).select_related('category').order_by('-date')
        category = self.request.query_params.get('category', None)
        min_amount = self.request.query_params.get('min_amount', None)
        date = self.request.query_params.get('date', None)

        if category:
            queryset = queryset.filter(category_id=category)
        if min_amount:
            queryset = queryset.filter(amount__gte=min_amount)
        if date:
            queryset = queryset.filter(date=date)

        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)


class CurrencyConverter(APIView):
    def get(self, request):
        base_currency = request.query_params.get('base', 'USD')
        target_currency = request.query_params.get('target', 'INR')

        api_url = f"https://api.exchangerate-api.com/v4/latest/{base_currency}"
        try:
            response = requests.get(api_url, timeout=5)
            if response.status_code != 200:
                return Response({"error": "Failed to fetch exchange rates"}, status=500)
            data = response.json()
            conversion_rate = data["rates"].get(target_currency, None)
            if conversion_rate:
                return Response({"rate": conversion_rate}, status=200)
            return Response({"error": "Invalid currency"}, status=400)
        except Exception:
            # Fallback rate if external API fails
            return Response({"rate": 83.5, "fallback": True}, status=200)


class BudgetView(generics.ListCreateAPIView):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Budget.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BudgetHistoryView(generics.ListAPIView):
    serializer_class = BudgetHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = BudgetHistory.objects.filter(user=self.request.user)
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        return qs