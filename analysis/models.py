from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _


class TireAnalysis(models.Model):
    """One analysis record per photo capture."""

    CONDITION_CHOICES = [
        ('good',     _('Baik')),
        ('worn',     _('Aus')),
        ('damaged',  _('Rusak')),
        ('unknown',  _('Tidak Diketahui')),
        ('not_tire', _('Bukan Ban')),
    ]

    CAMERA_MODE_CHOICES = [
        ('front', _('Depan')),
        ('rear',  _('Belakang')),
    ]

    user        = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analyses')
    image       = models.ImageField(upload_to='analyses/%Y/%m/%d/')
    condition   = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='unknown')
    label       = models.CharField(max_length=100, blank=True)
    confidence  = models.FloatField(default=0.0)
    tire_year   = models.PositiveIntegerField(null=True, blank=True)
    camera_mode = models.CharField(max_length=10, choices=CAMERA_MODE_CHOICES, default='front')
    raw_result  = models.JSONField(default=dict, blank=True)   # full JSON from ML pipeline
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name        = _('Analisis Ban')
        verbose_name_plural = _('Analisis Ban')

    def __str__(self):
        return f"{self.user.username} – {self.condition} ({self.created_at:%Y-%m-%d %H:%M})"

    def get_condition_display_color(self):
        return {
            'good':     '#22c55e',
            'worn':     '#f59e0b',
            'damaged':  '#ef4444',
            'not_tire': '#6b7280',
            'unknown':  '#6b7280',
        }.get(self.condition, '#6b7280')

    def confidence_percent(self):
        return round(self.confidence * 100, 1)
