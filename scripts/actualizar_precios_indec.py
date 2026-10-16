"""Descarga precios de referencia de carne vacuna y los guarda en
precios-indec.json, para la sección Media Res:

- INDEC, precios promedio al consumidor, región GBA (asado, nalga, cuadril, paleta):
  https://www.indec.gob.ar/ftp/cuadros/economia/sh_ipc_precios_promedio.xls
- IPCVA, precios al consumidor AMBA (resto de los cortes):
  https://ipcva.agrositio.com/estadisticas/vista_precios_consumidor2.php

Uso: python scripts/actualizar_precios_indec.py
"""
import html
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

import xlrd

URL = 'https://www.indec.gob.ar/ftp/cuadros/economia/sh_ipc_precios_promedio.xls'
SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'precios-indec.json')

# Variedad del INDEC -> clave del corte en la app
CORTES = {
    'asado': 'asado',
    'nalga': 'nalga',
    'cuadril': 'cuadril',
    'paleta': 'paleta',
    'carne picada comun': 'picada',
}
MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
         'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


def normalizar(texto):
    texto = unicodedata.normalize('NFKD', str(texto)).encode('ascii', 'ignore').decode()
    return ' '.join(texto.lower().split())


IPCVA_URL = 'https://ipcva.agrositio.com/estadisticas/vista_precios_consumidor2.php'
# Producto del IPCVA -> clave del corte en la app
IPCVA_CORTES = {
    'asado': 'asado', 'paleta': 'paleta', 'nalga': 'nalga', 'cuadril': 'cuadril',
    'bife angosto': 'bifeang', 'bife ancho': 'bifeanc', 'bola de lomo': 'bola',
    'cuadrada': 'cuadrada', 'falda': 'falda', 'lomo': 'lomo', 'osobuco': 'osobuco',
    'peceto': 'peceto', 'tapa de nalga': 'tapanalga', 'vacio': 'vacio',
    'colita de cuadril': 'colita', 'matambre': 'matambre', 'tapa de asado': 'tapaasado',
    'tortuguita': 'tortuguita', 'carnaza comun': 'carnaza', 'roast beef': 'roastbeef',
    'picada comun': 'picada', 'picada especial': 'picadaesp',
}
MESES_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']


def leer_ipcva():
    """Último mes con datos de la consulta de precios al consumidor del IPCVA (AMBA)."""
    pagina = urllib.request.urlopen(urllib.request.Request(
        IPCVA_URL, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read().decode('utf-8', 'replace')
    ids = re.findall(r'name="productos\[\]" value="(\d+)"', pagina)
    hoy = date.today()
    desde = date(hoy.year - 1 if hoy.month <= 4 else hoy.year, (hoy.month - 5) % 12 + 1, 1)
    form = [('mes_desde', '%02d-01' % desde.month), ('ano_desde', str(desde.year)),
            ('mes_hasta', '%02d-01' % hoy.month), ('ano_hasta', str(hoy.year))]
    form += [('productos[]', i) for i in ids]
    req = urllib.request.Request(IPCVA_URL, data=urllib.parse.urlencode(form).encode(),
                                 headers={'User-Agent': 'Mozilla/5.0'})
    s = urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'replace')
    s = s[s.find('Moneda Corriente'):]
    celdas = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip()
              for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', s, re.S)]
    celdas = [c for c in celdas if c]
    i = celdas.index('Período')
    # Encabezados hasta la primera fila de período (ej. "Sep-26")
    j = i + 1
    while j < len(celdas) and not re.match(r'^[A-Za-z]{3}-\d{2}$', celdas[j]):
        j += 1
    cols = celdas[i + 1:j]
    filas = []
    while j + len(cols) < len(celdas) and re.match(r'^[A-Za-z]{3}-\d{2}$', celdas[j]):
        filas.append((celdas[j], celdas[j + 1:j + 1 + len(cols)]))
        j += 1 + len(cols)
    for periodo, valores in reversed(filas):
        precios = {}
        for nombre, v in zip(cols, valores):
            clave = IPCVA_CORTES.get(normalizar(nombre))
            try:
                if clave:
                    precios[clave] = round(float(v), 2)
            except ValueError:
                pass
        if precios:
            mes, anio = periodo.split('-')
            return {'fuente': 'IPCVA - Precios al consumidor', 'region': 'AMBA',
                    'periodo': '20%s-%02d' % (anio, MESES_EN.index(mes.lower()) + 1),
                    'precios': precios}
    sys.exit('No se encontraron precios en la consulta del IPCVA')


def main():
    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        datos = r.read()
    hoja = xlrd.open_workbook(file_contents=datos).sheet_by_name('GBA')

    # Fila de años ("Año 2026" o 2026.0) y fila de meses
    fila_anios = fila_meses = None
    for r in range(min(hoja.nrows, 10)):
        valores = [normalizar(v) for v in hoja.row_values(r)]
        if any(v in MESES for v in valores):
            fila_meses = r
            fila_anios = r - 1
            break
    if fila_meses is None:
        sys.exit('No se encontró la fila de meses en la hoja GBA')

    filas = {}
    for r in range(hoja.nrows):
        nombre = normalizar(hoja.cell_value(r, 0))
        if nombre in CORTES:
            filas[CORTES[nombre]] = r
    if 'nalga' not in filas:
        sys.exit('No se encontraron los cortes de carne en la hoja GBA')

    # Última columna con dato numérico en la fila de nalga
    col = max(c for c in range(hoja.ncols)
              if isinstance(hoja.cell_value(filas['nalga'], c), float))

    mes = normalizar(hoja.cell_value(fila_meses, col))
    anio = None
    for c in range(col, -1, -1):
        v = hoja.cell_value(fila_anios, c)
        digitos = ''.join(ch for ch in str(v).split('.')[0] if ch.isdigit())
        if len(digitos) == 4:
            anio = int(digitos)
            break
    if mes not in MESES or anio is None:
        sys.exit('No se pudo leer el período (%r, %r)' % (mes, anio))

    precios = {}
    for clave, r in filas.items():
        v = hoja.cell_value(r, col)
        if isinstance(v, float) and v > 0:
            precios[clave] = round(v, 2)

    periodo = '%d-%02d' % (anio, MESES.index(mes) + 1)
    nuevo = {
        'fuente': 'INDEC - Precios promedio al consumidor',
        'region': 'GBA',
        'periodo': periodo,
        'precios': precios,
        'ipcva': leer_ipcva(),
    }

    anterior = None
    if os.path.exists(SALIDA):
        with open(SALIDA, encoding='utf-8') as f:
            anterior = json.load(f)
    if anterior and {k: anterior.get(k) for k in nuevo} == nuevo:
        print('Sin cambios (%s)' % periodo)
        return

    nuevo['actualizado'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(nuevo, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('Precios INDEC %s: %s' % (periodo, precios))
    print('Precios IPCVA %s: %s' % (nuevo['ipcva']['periodo'], nuevo['ipcva']['precios']))


if __name__ == '__main__':
    main()
