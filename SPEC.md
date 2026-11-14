# Especificación vigente

Esta es la referencia técnica de implementación. Las reglas de trabajo están en `Agent.md`; el contexto y propósito académico están en `PROJECT.md`.

## Alcance

- Página estática en español, ejecutada con servidor HTTP local.
- Navegación: simulador, materiales y presupuesto, e informe imprimible.
- Maqueta 3D interactiva de la vivienda como vista principal, con techo, frontones, muros, ventanas, puertas y piso. Ofrece controles accesibles para seleccionar componentes y orientar la cámara.
- Escenarios editables y representación conceptual de conducción e infiltración.
- Three.js está incluido localmente en `vendor/` y se usa para renderizar el modelo. No se ofrece una vista 2D alternativa.
- Sin backend. Puedes incorporar librerías, fuentes o recursos externos cuando mejoren de forma clara la experiencia; deja una alternativa usable si el recurso externo no carga.

## Organización actual

```text
assets/                 iconos
src/main.js             inicialización y coordinación
src/state.js            estado compartido
src/data/               catálogo y escenarios
src/model/              vivienda, indicadores y estimaciones puras
src/ui/                 vistas y controles de interfaz
src/ui/aura-dashboard.js escenas de clima e indicadores conectados al estado
src/experimental/three/ experimentos Three.js no conectados al flujo principal
vendor/                 código de terceros ya incluido
prototipos/             conceptos Casa Viva, ClimaLab y Aura Casa; Aura es la interfaz principal
index.html
styles.css
Agent.md                reglas de trabajo
SPEC.md                 esta especificación técnica
PROJECT.md               contexto de producto
```

No muevas archivos si sus rutas están referenciadas desde HTML o módulos. Mantén nombres en minúsculas con guiones para nuevos módulos.

## Estado y eventos

El estado central vive en `src/state.js`. Dimensiones, componente seleccionado, capas visibles, intervenciones activas y escenario son datos fuente. Las superficies, cantidades y costos se recalculan desde esos datos; no se guardan como resultados editables duplicados.

Al cambiar dimensiones, materiales, precios, intervenciones o escenario, actualiza simulador, presupuesto e informe sin recargar la página. La configuración se guarda en `localStorage`; si los datos están corruptos o son incompatibles, usa valores iniciales.

## Contrato de materiales

Cada material declara:

- `id`, `name`, `category`.
- `salesUnit`: unidad que se compra, por ejemplo `package`, `unit`, `m`, `m2` o `can`.
- `coveragePerPackage`: cantidad física cubierta por una unidad vendible.
- `coverageUnit`: unidad compatible con la cantidad de intervención: `m2`, `m` o `unit`.
- `packagePriceClp`: precio por una unidad vendible.
- `priceStatus`: `illustrative`, `manual` o `verified`.
- `priceSource` y `priceUpdatedAt`: solo para precio verificado o una fuente efectivamente ingresada; en caso contrario `null`.
- Propiedades térmicas solo si se conocen; datos de demostración deben marcarse como tales.

La mano de obra pertenece a la intervención, no al material. Declara `laborCostClp` y `laborUnit` (`m2`, `m` o `unit`).

## Cantidades y costos

Cada intervención declara `quantityMode`, `quantityUnit`, `wasteRate` y, cuando aplique, `fixedQuantity`:

- `area`: superficie neta del componente, en m².
- `perimeter`: perímetro de las aberturas del componente, en metros.
- `count`: número de ventanas o puertas, en unidades.
- `fixed`: cantidad supuesta explícita para una intervención demostrativa; debe etiquetarse como supuesto.

Fórmulas:

```text
cantidad de compra = cantidad base × (1 + desperdicio)
unidades vendibles = techo(cantidad de compra / cobertura por unidad vendible)
costo material = unidades vendibles × precio por unidad vendible
costo mano de obra = cantidad base × tarifa de mano de obra por unidad
total intervención = costo material + costo mano de obra + otros costos explícitos
```

No apliques desperdicio a conteos discretos si el producto se compra por unidad. En materiales vendidos por unidad, cuenta aberturas; no conviertas superficie en unidades. En sellos, usa perímetros; no uses m² de ventanas o muros. Valida cantidades, precios, desperdicios y cobertura no negativos, y cobertura mayor que cero. Conserva precisión en cantidades hasta el redondeo de unidades vendibles.

La interfaz y el informe muestran unidad, cantidad base, desperdicio, unidades compradas, tarifa, subtotal de material, mano de obra y total. Los escenarios usan exactamente el mismo cálculo.

El catálogo permite editar precio y cobertura de cada material. Un precio editado se marca como manual y se guarda en `localStorage`; datos inválidos o de otra versión se ignoran. No se ofrece edición de precios verificados sin registrar su fuente.

## Datos de demostración y referencias

No describas precios de ejemplo como precios de mercado. Para datos sintéticos usa `priceStatus: "illustrative"`, `priceSource: null`, `priceUpdatedAt: null` y una etiqueta visible “Precio de demostración”.

Un precio solo puede ser `verified` si hay fuente directa identificable y fecha de consulta. Un dato técnico no verificado debe ser `null` o llevar una marca ilustrativa visible. No inventes referencias para completar campos.

## Criterios de aceptación

1. El proyecto inicia con el servidor local documentado; los recursos externos opcionales tienen alternativas locales o de sistema.
2. La maqueta 3D cierra los encuentros principales entre muros, frontones, cubierta, ventanas y puertas; cambiar dimensiones actualiza su geometría.
3. Cambiar dimensiones o intervenciones actualiza la casa, los tres escenarios, el desglose y el informe.
4. Cantidades de área, perímetro y unidades se estiman con bases compatibles.
5. El cálculo distingue superficie neta, desperdicio, unidades de compra, material y mano de obra.
6. Todas las cifras de demostración se identifican; no hay fuentes o fechas inventadas.
7. Indicadores y flechas son conceptuales, no mediciones ni predicciones de ahorro.
8. La interfaz conserva accesibilidad, adaptación móvil y advertencias de ventilación y humedad.
