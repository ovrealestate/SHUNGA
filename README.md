# Inventario SHUNGA · Beach & Love

Inventario privado con 22 modelos y 43 variantes. Las existencias se guardan en la columna G (Existencia física) de la pestaña Inventario de Google Sheets mediante una conexión firmada con Google Apps Script. Cloudflare aloja la página y exige el acceso compartido.

URL: https://shunga.ovrealestate.workers.dev

## Operación

Acceder con el usuario y la contraseña compartidos proporcionados al personal. Seleccionar una existencia de 0 a 20 deja un cambio pendiente. Cada cuadro de producto tiene un botón Guardar que guarda sus variantes modificadas. “Sin contar” elimina el conteo; cero significa sin unidades. La página confirma el guardado o muestra el error. Actualizar consulta los datos persistidos. La conexión comprueba el conteo anterior y su revisión bajo un bloqueo antes de escribir únicamente la columna G. Conserva las fórmulas y el resto de columnas.

Las categorías y la búsqueda se mantienen. El botón Imprimir abre un PDF de faltantes. Se incorporaron 21 fotografías del catálogo PDF proporcionado y la fotografía adicional de SH44 confirmada por el usuario: los 22 modelos tienen fotografía. Las notas de fotos de referencia y empaques por verificar se conservan. Las imágenes e información se guardan en la tabla privada catalog_assets y se sirven únicamente tras autenticar al usuario.

## Configuración

La página utiliza exclusivamente Google Sheets para consultar y guardar existencias. La base D1 anterior se conserva como respaldo de los conteos previos; la página no escribe en ella.

El secreto `AUTH_HASH` ya está configurado en Cloudflare; contiene el SHA-256 de la combinación usuario:contraseña. La aplicación exige autenticación tanto para la página como para la API y valida el origen de las escrituras. No guardar credenciales en este repositorio.

La conexión de Google Apps Script fue autorizada por el propietario. El personal no necesita iniciar sesión con Google. `SHEETS_ENDPOINT` es un secreto de Cloudflare; no publicar la URL de conexión ni el código privado de Apps Script.

## Validación

`npm test` (Node.js 22 o posterior). Cubre autenticación, firma de la conexión, guardado confirmado, conflictos, origen y límites. Despliegue desde main mediante la conexión existente de Cloudflare Builds.

## Poner todo en 0

El botón superior abre una advertencia que indica que afecta a todas las variantes, incluso si hay filtros activos. Cancelar no guarda nada. Confirmar envía una solicitud firmada a Sheets. La conexión verifica los conteos y revisiones actuales bajo un bloqueo, conserva last_reset_backup en las propiedades privadas del proyecto y escribe únicamente la columna G en una operación. Si cambió algún conteo desde la carga, rechaza el reinicio y solicita actualizar. No se ejecuta ningún reinicio durante los despliegues.

## Diseño del catálogo

La página replica la paleta del PDF (rosa #D34B76, rosa claro #FCECF1, blanco y gris), la tipografía sin serifas, las categorías numeradas y las fichas horizontales con franja lateral y tabla de variantes. En móvil las fotografías se colocan encima de los datos. Los conteos, Guardar y la advertencia de Poner todo en 0 conservan su funcionamiento.

## Columnas comerciales e impresión

En Inventario se añadieron M Costo, N Precio público y O Marca. Costo y precio público quedan vacíos para captura posterior; marca es 85 en las 43 variantes existentes. Las columnas G y H conservan su ubicación y fórmulas.

Imprimir abre /faltantes.pdf y consulta Google Sheets en ese momento. Solo incluye valores numéricos positivos de la columna H, con Descripción, Color y Cantidad en una cuadrícula. No calcula el faltante de nuevo ni usa cambios locales pendientes. El PDF se genera con pdf-lib, repite encabezados al cambiar de página y no se almacena en caché. Actualizar vuelve a consultar la hoja y conserva los cambios locales pendientes para guardarlos mediante Guardar.
