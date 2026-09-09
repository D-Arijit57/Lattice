"""
conftest.py at the project root: pytest auto-discovers this file and makes
every fixture defined here available to all test modules, with no import.
"""
import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture
def api_client():
    # A fresh DRF test client per test. Same object as `self.client` was
    # in APITestCase - it speaks JSON and can fake authentication.
    return APIClient()


@pytest.fixture
def user(db):
    # Depending on `db` (a pytest-django fixture) gives this fixture - and
    # any test that requests it - access to the throwaway test database.
    return User.objects.create_user(
        email="ada@example.com",
        name="Ada",
        password="pw12345",
    )
