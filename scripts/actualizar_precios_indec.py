"""Descarga los precios promedio al consumidor del INDEC (región GBA) y
guarda los de carne vacuna en precios-indec.json, para la sección Media Res.

Fuente: https://www.indec.gob.ar/ftp/cuadros/economia/sh_ipc_precios_promedio.xls
Uso: python scripts/actualizar_precios_indec.py
"""
import json
import os
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone

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


if __name__ == '__main__':
    main()
