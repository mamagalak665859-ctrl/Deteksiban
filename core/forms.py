from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _


class RegisterForm(UserCreationForm):
    first_name = forms.CharField(
        max_length=50, required=False,
        label=_("Nama Depan"),
        widget=forms.TextInput(attrs={'placeholder': _('Nama depan Anda'), 'autocomplete': 'given-name'})
    )
    last_name = forms.CharField(
        max_length=50, required=False,
        label=_("Nama Belakang"),
        widget=forms.TextInput(attrs={'placeholder': _('Nama belakang Anda'), 'autocomplete': 'family-name'})
    )
    email = forms.EmailField(
        required=True,
        label=_("Email"),
        widget=forms.EmailInput(attrs={'placeholder': 'email@example.com', 'autocomplete': 'email'})
    )

    class Meta:
        model  = User
        fields = ('username', 'first_name', 'last_name', 'email', 'password1', 'password2')
        widgets = {
            'username': forms.TextInput(attrs={'placeholder': _('Username unik'), 'autocomplete': 'username'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['password1'].widget = forms.PasswordInput(
            attrs={'placeholder': _('Kata sandi'), 'autocomplete': 'new-password'})
        self.fields['password2'].widget = forms.PasswordInput(
            attrs={'placeholder': _('Konfirmasi kata sandi'), 'autocomplete': 'new-password'})

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError(_("Email ini sudah terdaftar."))
        return email


class LoginForm(AuthenticationForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget = forms.TextInput(
            attrs={'placeholder': _('Username'), 'autocomplete': 'username'})
        self.fields['password'].widget = forms.PasswordInput(
            attrs={'placeholder': _('Kata sandi'), 'autocomplete': 'current-password'})


class AvatarForm(forms.ModelForm):
    class Meta:
        from core.models import UserProfile
        model  = UserProfile
        fields = ['avatar']
