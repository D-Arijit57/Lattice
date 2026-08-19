from django.db import models


# Organization
# models.model is the base class for django for database_backed models
# interpretation - Organization is a database entity. Take the fields I define inside this class and use them to construct/manage the corresponding database table.
# django fields are non-null by default
class Organization(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
