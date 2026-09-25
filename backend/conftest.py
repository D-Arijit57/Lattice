"""
conftest.py at the project root: pytest auto-discovers this file and makes
every fixture defined here available to all test modules, with no import.
"""
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import Organization, User
from content.models import ContentType


@pytest.fixture(autouse=True)
def clear_throttle_counters():
    # Throttle counts live in the cache, which survives between tests in one
    # run. Without this, requests made by earlier tests would count against
    # the login/signup limits and later tests would fail with 429 at random.
    cache.clear()


@pytest.fixture
def api_client():
    # A fresh DRF test client per test. Same object as `self.client` was
    # in APITestCase - it speaks JSON and can fake authentication.
    return APIClient()


@pytest.fixture
def content_type(db):
    # An Organization + ContentType, with no Fields attached - tests that
    # need Fields create them against this ContentType.
    organization = Organization.objects.create(name="Netflix")
    return ContentType.objects.create(
        organization=organization, name="Movie", slug="movie"
    )


@pytest.fixture
def user(db):
    # Depending on `db` (a pytest-django fixture) gives this fixture - and
    # any test that requests it - access to the throwaway test database.
    return User.objects.create_user(
        email="ada@example.com",
        name="Ada",
        password="pw12345",
    )
