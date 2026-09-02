from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MealTypeViewSet, MenuItemViewSet, MenuViewSet, StudentMealSkipViewSet, MessBillingViewSet

router = DefaultRouter()
router.register(r'meal-types', MealTypeViewSet, basename='mealtype')
router.register(r'menu-items', MenuItemViewSet, basename='menuitem')
router.register(r'menus', MenuViewSet, basename='menu')
router.register(r'skips', StudentMealSkipViewSet, basename='mealskip')
router.register(r'billing', MessBillingViewSet, basename='messbilling')

urlpatterns = [
    path('', include(router.urls)),
]
