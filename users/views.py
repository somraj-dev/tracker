from rest_framework import generics, status
from rest_framework.response import Response
from django.contrib.auth import get_user_model, authenticate
User = get_user_model()
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer, SignupSerializer, ProfileSerializer, FinancialDataSerializer
from .models import Profile, FinancialData
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils.timezone import now
from django.shortcuts import render
from notifications.models import Notification

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_data(request):
    user = request.user  # Get the logged-in user
    serializer = UserSerializer(user)  # Convert user object to JSON
    return Response(serializer.data)  # Return JSON response

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_avatar(request):
    user = request.user
    if 'avatar' in request.FILES:
        user.avatar = request.FILES['avatar']
        user.save()
        return Response({"message": "Avatar updated successfully!", "avatar": user.avatar.url})
    return Response({"error": "No file uploaded"}, status=400)



from django.shortcuts import render, redirect
from django.contrib.auth import login as auth_login

class SignupView(APIView):
    def get(self, request):
        return render(request, 'frontend/signup.html')

    def post(self, request):
        data = request.data.copy()
        if 'full_name' in data and not data.get('username'):
            data['username'] = data['full_name'].strip().replace(' ', '_').lower()

        serializer = SignupSerializer(data=data)
        if serializer.is_valid():
            user = serializer.save()
            auth_login(request, user)
            if request.content_type != 'application/json':
                return redirect('dashboard')
            return Response({"message": "User created successfully", "redirect": "/dashboard/"}, status=status.HTTP_201_CREATED)
        
        if request.content_type != 'application/json':
            return render(request, 'frontend/signup.html', {'errors': serializer.errors})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    def get(self, request):
        return render(request, 'frontend/login.html')

    def post(self, request):
        identifier = (request.data.get("username") or request.data.get("email") or "").strip()
        password = request.data.get("password")

        user = None
        if identifier and '@' in identifier:
            user_obj = User.objects.filter(email__iexact=identifier).first()
        elif identifier:
            user_obj = User.objects.filter(username__iexact=identifier).first() or User.objects.filter(email__iexact=identifier).first()
        else:
            user_obj = None

        if user_obj and user_obj.check_password(password):
            user = user_obj

        if user:
            auth_login(request, user)
            refresh = RefreshToken.for_user(user)
            if request.content_type != 'application/json':
                return redirect('dashboard')
            return Response({
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "message": "Login successful",
                "redirect": "/dashboard/"
            }, status=status.HTTP_200_OK)
        
        if request.content_type != 'application/json':
            return render(request, 'frontend/login.html', {'error': 'Invalid username/email or password.'})
        return Response({"error": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED)




class ProfileSetupView(generics.RetrieveUpdateAPIView):
    """Handles Profile Setup"""
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return Profile.objects.get_or_create(user=self.request.user)[0]

class FinancialInputView(generics.RetrieveUpdateAPIView):
    """Handles Financial Inputs"""
    queryset = FinancialData.objects.all()
    serializer_class = FinancialDataSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return FinancialData.objects.get_or_create(user=self.request.user)[0]

class FinancialDataView(generics.RetrieveAPIView):
    serializer_class = FinancialDataSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        data = get_object_or_404(UsersFinancialData, user_id=user_id)
        return Response(self.get_serializer(data).data)



### 🚀 User Profile API ###
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """
    Fetch user profile details including avatar and username.
    """
    user = request.user
    avatar_url = "https://via.placeholder.com/100"
    try:
        if hasattr(user, 'profile') and user.profile.avatar:
            avatar_url = user.profile.avatar.url
    except Exception:
        pass

    profile_data = {
        "id": str(user.id),
        "username": user.username,
        "avatar": avatar_url
    }
    return JsonResponse(profile_data)

### 🚀 User Notifications API ###
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_notifications(request):
    """
    Fetch notifications for the authenticated user.
    - If recipient is 'all', fetch for all users.
    - If recipient is 'premium' or 'free', fetch based on user's subscription.
    """
    user = request.user
    subscription_type = "premium" if user.is_premium else "free"

    notifications = Notification.objects.filter(
        recipients__in=["all", subscription_type, ""]
    ).order_by('-timestamp')

    notifications_list = [
        {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "status": notification.status,
            "timestamp": notification.timestamp.strftime("%Y-%m-%d %H:%M:%S") if notification.timestamp else ""
        } for notification in notifications
    ]

    return JsonResponse(notifications_list, safe=False)
