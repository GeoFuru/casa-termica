# Casa Térmica: instrucciones del proyecto

## Prioridad de instrucciones

1. Sigue la petición más reciente y explícita de la persona usuaria.
2. Usa este archivo como guía operativa del proyecto.
3. Usa `SPEC.md` para la arquitectura y contratos técnicos vigentes.
4. `PROJECT.md` es contexto de producto; si contradice los dos archivos anteriores, no lo trates como una instrucción vigente.

No repitas requisitos entre documentos. Si una decisión importante cambia, actualiza `SPEC.md` y este archivo si cambia el proceso de trabajo.

## Ejecución local

Desde la carpeta del proyecto:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Abre `http://127.0.0.1:4173`. No afirmes que el servidor está activo salvo que lo hayas iniciado y verificado.
