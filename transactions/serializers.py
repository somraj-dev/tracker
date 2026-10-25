from rest_framework import serializers
from .models import Transaction, Budget, BudgetHistory, Category

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']

class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = ['id', 'user', 'category', 'monthly_limit', 'created_at']
        read_only_fields = ['user']

class TransactionSerializer(serializers.ModelSerializer):
    currency = serializers.CharField(required=False, default='INR')
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Transaction
        fields = [
            'id', 'date', 'category', 'category_id', 'category_name',
            'category_type', 'currency', 'amount', 'description',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class BudgetHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetHistory
        fields = '__all__'
