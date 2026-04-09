from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from .models import Paquete


class PaqueteListView(LoginRequiredMixin, ListView):
    model = Paquete
    template_name = 'paquetes/lista.html'
    context_object_name = 'paquetes'


class PaqueteCreateView(LoginRequiredMixin, CreateView):
    model = Paquete
    template_name = 'paquetes/formulario.html'
    fields = ['nombre', 'descripcion', 'precio', 'estado']
    success_url = reverse_lazy('lista_paquetes')


class PaqueteUpdateView(LoginRequiredMixin, UpdateView):
    model = Paquete
    template_name = 'paquetes/formulario.html'
    fields = ['nombre', 'descripcion', 'precio', 'estado']
    success_url = reverse_lazy('lista_paquetes')


class PaqueteDeleteView(LoginRequiredMixin, DeleteView):
    model = Paquete
    template_name = 'paquetes/eliminar.html'
    success_url = reverse_lazy('lista_paquetes')