from datetime import date, timedelta
import re


def calcular_vencimiento(fecha_inicio: date, meses: int) -> date:
    """Retorna la fecha de vencimiento sumando N meses a la fecha de inicio."""
    if meses <= 0:
        raise ValueError("Los meses deben ser un número positivo.")
    mes = fecha_inicio.month - 1 + meses
    anio = fecha_inicio.year + mes // 12
    mes = mes % 12 + 1
    ultimo_dia = (date(anio, mes % 12 + 1, 1) - timedelta(days=1)).day if mes != 12 else 31
    dia = min(fecha_inicio.day, ultimo_dia)
    return date(anio, mes, dia)


def suscripcion_activa(fecha_fin: date, hoy: date = None) -> bool:
    """Retorna True si la suscripción aún no ha vencido."""
    hoy = hoy or date.today()
    return fecha_fin >= hoy


def dias_restantes(fecha_fin: date, hoy: date = None) -> int:
    """Retorna los días que quedan hasta el vencimiento (negativo si ya venció)."""
    hoy = hoy or date.today()
    return (fecha_fin - hoy).days


def calcular_monto_total(precio_mensual: float, meses: int) -> float:
    """Calcula el monto total a cobrar por N meses."""
    if precio_mensual < 0 or meses <= 0:
        raise ValueError("Precio y meses deben ser valores positivos.")
    return round(precio_mensual * meses, 2)


def validar_email(email: str) -> bool:
    """Valida que el email tenga un formato básico correcto."""
    patron = r"^[\w\.-]+@[\w\.-]+\.\w{2,}$"
    return bool(re.match(patron, email))


def nombre_completo(nombre: str, apellido: str) -> str:
    """Retorna el nombre completo con capitalización correcta."""
    if not nombre.strip() or not apellido.strip():
        raise ValueError("Nombre y apellido no pueden estar vacíos.")
    return f"{nombre.strip().title()} {apellido.strip().title()}"


def aplicar_descuento(monto: float, porcentaje: float) -> float:
    """Aplica un descuento porcentual al monto y retorna el valor final."""
    if not (0 <= porcentaje <= 100):
        raise ValueError("El porcentaje debe estar entre 0 y 100.")
    return round(monto * (1 - porcentaje / 100), 2)
