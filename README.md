# Inventario SHUNGA · Beach & Love

Inventario privado con 22 modelos y 43 variantes. Las existencias se guardan en la columna G (Existencia física) de la pestaña Inventario de Google Sheets mediante una conexión firmada con Google Apps Script. Cloudflare aloja la página y exige el acceso compartido.

URL: https://shunga.ovrealestate.workers.dev

## Operación

Acceder con el usuario y la contraseña compartidos proporcionados al personal. Seleccionar una existencia de 0 a 20 deja un cambio pendiente. Cada cuadro de producto tiene un botón Guardar que guarda sus variantes modificadas. “Sin contar” elimina el conteo; cero significa sin unidades. La página confirma el guardado o muestra el error. Actualizar consulta los datos persistidos. La conexión comprueba el conteo anterior y su revisión bajo un bloqueo antes de escribir únicamente la columna G. Conserva las fórmulas y el resto de columnas.

Las categorías y la búsqueda se mantienen. No hay botón de impresión. Las fotografías originales siguen pendientes de recuperar.

## Configuración

La página utiliza exclusivamente Google Sheets para consultar y guardar existencias. La base D1 anterior se conserva como respaldo de los conteos previos; la página no escribe en ella.

El secreto `AUTH_HASH` ya está configurado en Cloudflare; contiene el SHA-256 de la combinación usuario:contraseña. La aplicación exige autenticación tanto para la página como para la API y valida el origen de las escrituras. No guardar credenciales en este repositorio.

La conexión de Google Apps Script fue autorizada por el propietario. El personal no necesita iniciar sesión con Google. `SHEETS_ENDPOINT` es un secreto de Cloudflare; no publicar la URL de conexión ni el código privado de Apps Script.

## Validación

`npm test` (Node.js 22 o posterior). Cubre autenticación, firma de la conexión, guardado confirmado, conflictos, origen y límites. Despliegue desde main mediante la conexión existente de Cloudflare Builds.
