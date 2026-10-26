# Inventario SHUNGA · Beach & Love

Inventario privado con 22 modelos y 43 variantes. Las existencias se guardan directamente en Cloudflare D1. Google Sheets se usó únicamente para la carga inicial; los conteos posteriores no se sincronizan con esa hoja.

URL: https://shunga.ovrealestate.workers.dev

## Operación

Acceder con el usuario y la contraseña compartidos proporcionados al personal. Seleccionar una existencia de 0 a 20 deja un cambio pendiente. Cada cuadro de producto tiene un botón Guardar que guarda sus variantes modificadas. “Sin contar” elimina el conteo; cero significa sin unidades. La página confirma el guardado o muestra el error. Actualizar consulta los datos persistidos. La escritura comprueba la revisión en una sola operación para evitar sobrescribir cambios simultáneos; un disparador conserva el historial en `inventory_history`.

Las categorías y la búsqueda se mantienen. No hay botón de impresión. Las fotografías originales siguen pendientes de recuperar.

## Configuración

`wrangler.jsonc` vincula `DB` con la base existente `shunga-inventory`. No recrear ni vaciar esa base al desplegar. `schema.sql` crea las tablas sin reemplazar datos. El inventario inicial se importó directamente a D1, no está incluido en este repositorio público.

El secreto `AUTH_HASH` ya está configurado en Cloudflare; contiene el SHA-256 de la combinación usuario:contraseña. La aplicación exige autenticación tanto para la página como para la API y valida el origen de las escrituras. No guardar credenciales en este repositorio.

No se requiere Apps Script, OAuth ni autorización de Google para editar. La hoja original no se modifica.

## Validación

`npm test` (Node.js 22.13 o posterior con `node:sqlite`). Cubre autenticación, persistencia, conflictos, borrado del conteo, historial, origen y límites. Despliegue desde main mediante la conexión existente de Cloudflare Builds.
