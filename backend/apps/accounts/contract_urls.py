from django.urls import path

from .contract_views import ContractLoginView, ContractMeView, ContractRegisterView


urlpatterns = [
    path("login/", ContractLoginView.as_view(), name="contract-login"),
    path("register/", ContractRegisterView.as_view(), name="contract-register"),
    path("me/", ContractMeView.as_view(), name="contract-me"),
]
