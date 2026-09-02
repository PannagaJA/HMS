from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MealTypeViewSet, MenuItemViewSet, MenuViewSet, StudentMealSkipViewSet

router = DefaultRouter()
router.register(r'meal-types', MealTypeViewSet, basename='mealtype')
router.register(r'menu-items', MenuItemViewSet, basename='menuitem')
router.register(r'menus', MenuViewSet, basename='menu')
router.register(r'skips', StudentMealSkipViewSet, basename='mealskip')

urlpatterns = [
    path('', include(router.urls)),
]
