# Validación inicial en la máquina

El postprocesador reproduce el formato del archivo real `andina.tap`, pero el nuevo recorrido automático debe validarse físicamente una vez antes de usarlo en producción.

## 1. Verificación en GRBL Control

- Abrir `output/puma-logo-placa-1.tap`.
- No encender el hilo.
- Confirmar que el archivo carga sin errores.
- Confirmar que el origen aparece abajo a la izquierda.
- Confirmar que el ancho máximo es menor que 1250 mm.
- Confirmar que el alto máximo es menor que 600 mm.
- Confirmar que no hay coordenadas negativas.

## 2. Corrida en seco

- Retirar o apagar la alimentación del hilo caliente.
- Llevar el carro al punto físico elegido como origen.
- Poner a cero exactamente como en el flujo actual.
- Ejecutar a velocidad reducida si GRBL Control lo permite.
- Tener disponible la parada de emergencia.
- Verificar sentido de X.
- Verificar sentido de Y.
- Verificar escala con un movimiento conocido de 100 mm.
- Verificar que el recorrido no golpea finales de carrera.
- Verificar que el último movimiento vuelve a X0 Y0.

## 3. Prueba geométrica mínima

Generar un SVG con:

- un cuadrado de 100 × 100 mm;
- un segundo cuadrado separado 20 mm;
- un origen debajo y a la izquierda.

Medir físicamente:

- lado X: 100 mm;
- lado Y: 100 mm;
- separación: 20 mm;
- sentido y orientación.

## 4. Prueba con hueco

Usar una letra `O`, `P` o `A` y confirmar:

- acceso al hueco;
- recorrido completo del hueco;
- regreso por la misma unión;
- corte posterior del contorno exterior;
- ausencia de cruces no deseados.

## 5. Prueba del nesting del Puma

- Usar una placa de descarte.
- Comenzar con temperatura baja.
- Confirmar que las uniones verdes atraviesan solamente descarte.
- Confirmar que las uniones violetas producen los accesos esperados.
- Comparar las piezas con el SVG vinculado.
- Registrar velocidad, temperatura y observaciones.

## 6. Cierre de la calibración

Al aprobar la prueba:

- guardar el TAP exacto utilizado;
- guardar una foto o video de la ejecución;
- registrar versión `1.0.0` del motor;
- registrar hash del perfil JSON;
- agregar el archivo como fixture de regresión;
- marcar el perfil como validado físicamente en la base de datos de Grafo.

## Criterios de rechazo

No utilizar el archivo para corte con hilo encendido si ocurre cualquiera de estos casos:

- eje invertido;
- escala incorrecta;
- origen inesperado;
- movimiento fuera del área útil;
- error de comando en GRBL Control;
- retorno incorrecto al origen;
- unión que atraviesa una pieza útil;
- recorrido discontinuo.
