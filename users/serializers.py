from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Profile, FinancialData

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    phone_number = serializers.CharField(source='phone_no', required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'phone_number', 'phone_no']
        extra_kwargs = {
            'phone_no': {'required': False},
            'username': {'required': False}
        }

    def create(self, validated_data):
        password = validated_data.pop('password')
        if not validated_data.get('username'):
            validated_data['username'] = validated_data.get('email', '').split('@')[0]
        user = User.objects.create_user(password=password, **validated_data)
        return user

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'

class FinancialDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialData
        fields = '__all__'
