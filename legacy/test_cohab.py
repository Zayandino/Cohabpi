import pytest
from datetime import date
from cohab_logica import (
    calcular_vencimiento,
    suscripcion_activa,
    dias_restantes,
    calcular_monto_total,
    validar_email,
    nombre_completo,
    aplicar_descuento,
)


# --- calcular_vencimiento ---

def test_vencimiento_un_mes():
    assert calcular_vencimiento(date(2025, 1, 15), 1) == date(2025, 2, 15)

def test_vencimiento_varios_meses():
    assert calcular_vencimiento(date(2025, 1, 1), 6) == date(2025, 7, 1)

def test_vencimiento_cruza_anio():
    assert calcular_vencimiento(date(2025, 11, 10), 3) == date(2026, 2, 10)

def test_vencimiento_meses_invalidos():
    with pytest.raises(ValueError):
        calcular_vencimiento(date(2025, 1, 1), 0)

def test_vencimiento_meses_negativos():
    with pytest.raises(ValueError):
        calcular_vencimiento(date(2025, 1, 1), -2)


# --- suscripcion_activa ---

def test_suscripcion_activa_hoy():
    hoy = date(2025, 6, 1)
    assert suscripcion_activa(date(2025, 6, 1), hoy=hoy) is True

def test_suscripcion_activa_futura():
    hoy = date(2025, 6, 1)
    assert suscripcion_activa(date(2025, 12, 31), hoy=hoy) is True

def test_suscripcion_vencida():
    hoy = date(2025, 6, 1)
    assert suscripcion_activa(date(2025, 5, 31), hoy=hoy) is False


# --- dias_restantes ---

def test_dias_restantes_positivo():
    hoy = date(2025, 6, 1)
    assert dias_restantes(date(2025, 6, 11), hoy=hoy) == 10

def test_dias_restantes_cero():
    hoy = date(2025, 6, 1)
    assert dias_restantes(date(2025, 6, 1), hoy=hoy) == 0

def test_dias_restantes_negativo():
    hoy = date(2025, 6, 10)
    assert dias_restantes(date(2025, 6, 1), hoy=hoy) == -9


# --- calcular_monto_total ---

def test_monto_un_mes():
    assert calcular_monto_total(15000.0, 1) == 15000.0

def test_monto_varios_meses():
    assert calcular_monto_total(15000.0, 3) == 45000.0

def test_monto_precio_con_centavos():
    assert calcular_monto_total(9999.99, 2) == 19999.98

def test_monto_precio_negativo():
    with pytest.raises(ValueError):
        calcular_monto_total(-100.0, 3)

def test_monto_meses_invalidos():
    with pytest.raises(ValueError):
        calcular_monto_total(15000.0, 0)


# --- validar_email ---

def test_email_valido():
    assert validar_email("alumno@cohab.cl") is True

def test_email_sin_arroba():
    assert validar_email("alumnocochabcl") is False

def test_email_sin_dominio():
    assert validar_email("alumno@") is False

def test_email_con_puntos():
    assert validar_email("nombre.apellido@correo.com") is True

def test_email_vacio():
    assert validar_email("") is False


# --- nombre_completo ---

def test_nombre_completo_basico():
    assert nombre_completo("juan", "perez") == "Juan Perez"

def test_nombre_completo_capitaliza():
    assert nombre_completo("MARIA", "GONZALEZ") == "Maria Gonzalez"

def test_nombre_completo_con_espacios():
    assert nombre_completo("  ana  ", "  torres  ") == "Ana Torres"

def test_nombre_vacio():
    with pytest.raises(ValueError):
        nombre_completo("", "Perez")

def test_apellido_vacio():
    with pytest.raises(ValueError):
        nombre_completo("Juan", "")


# --- aplicar_descuento ---

def test_descuento_diez_porciento():
    assert aplicar_descuento(10000.0, 10) == 9000.0

def test_descuento_cero():
    assert aplicar_descuento(10000.0, 0) == 10000.0

def test_descuento_cien_porciento():
    assert aplicar_descuento(10000.0, 100) == 0.0

def test_descuento_porcentaje_invalido():
    with pytest.raises(ValueError):
        aplicar_descuento(10000.0, 150)

def test_descuento_negativo():
    with pytest.raises(ValueError):
        aplicar_descuento(10000.0, -5)
