# FichaDoor

Sistema de control de asistencia por código QR para registrar entradas y salidas de operarios en planta industrial.

La aplicación se ejecuta en una tablet montada en la pared. El operario presenta su credencial QR frente a la cámara frontal y el sistema registra automáticamente el fichaje en Google Sheets.

---

## Cómo funciona

```
1. Se selecciona "Entrada" o "Salida"
2. Se abre la cámara frontal de la tablet
3. El operario presenta su credencial QR
4. El sistema valida y registra el fichaje
5. Se muestra confirmación o rechazo en pantalla
```

**Regla de negocio**: No puede haber dos eventos del mismo tipo consecutivos. Si hay una entrada registrada, debe haber una salida, y viceversa.

---

## Requisitos

- Node.js 18 o superior
- Cuenta de Google (para Google Sheets y Apps Script)
- Tablet con cámara frontal (iPad recomendado)
- Credenciales QR con el ID del operario (ej: `OP-014`)

---

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd attendance_control_QR_code

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Iniciar servidor de desarrollo
npm run dev
```

El servidor levanta con HTTPS (necesario para acceder a la cámara). La URL se muestra en la consola.

---

## Configuración de Google Sheets

### 1. Crear el spreadsheet

Crear un nuevo spreadsheet en Google Sheets y nombrarlo **Fichador**.

### 2. Crear las hojas indispensables

El sistema requiere exactamente estas 3 hojas:

#### Hoja: `Fichajes_Raw`

Historial completo de todos los fichajes. Esta hoja se llena automáticamente.

| Columna | Tipo | Ejemplo |
|---------|------|---------|
| A: `idFichaje` | texto | `FICH-1721836800000` |
| B: `fechaHora` | timestamp | `2026-07-24 06:00:00` |
| C: `idEmpleado` | texto | `OP-014` |
| D: `tipoEvento` | texto | `entrada` o `salida` |

#### Hoja: `Estado_Fichajes`

Control rápido de validación. Se actualiza automáticamente con cada fichaje. **Debe tener exactamente estas 3 columnas**:

| Columna | Tipo | Ejemplo |
|---------|------|---------|
| A: `idEmpleado` | texto | `OP-014` |
| B: `ultimoTipo` | texto | `entrada` o `salida` |
| C: `fechaUltimo` | timestamp | `2026-07-24 15:00:00` |

> No editar manualmente esta hoja. El sistema la mantiene automáticamente.

#### Hoja: `Operarios`

Lista maestra de empleados. Se usa para las credenciales QR y referencia.

| Columna | Tipo | Ejemplo |
|---------|------|---------|
| A: `idEmpleado` | texto | `OP-014` |
| B: `nombre` | texto | `Juan Pérez` |

> El contenido de la columna A (`idEmpleado`) es lo que debe codificarse en el código QR de cada operario.

---

## Configurar Google Apps Script

### 1. Abrir el editor de Apps Script

1. Abrir el spreadsheet **Fichador**
2. Ir a **Extensiones** > **Apps Script**
3. Se abre el editor en una nueva pestaña

### 2. Pegar el código

Reemplazar todo el contenido del archivo `Code.gs` con este código:

```javascript
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var fichajes = sheet.getSheetByName("Fichajes_Raw");
  var estado = sheet.getSheetByName("Estado_Fichajes");

  const idEmpleado = e.parameter.qrId;
  const tipoEvento = e.parameter.tipoEvento

  if (!idEmpleado || !tipoEvento) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, message: "Faltan parámetros", version: "0.0.2" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // 1. Buscar al empleado en la hoja de control (rápido)
  var estadoData = estado.getDataRange().getValues();
  var filaEmpleado = -1;
  var ultimoTipo = null;

  for (var i = 1; i < estadoData.length; i++) {
    if (estadoData[i][0] === idEmpleado) {
      filaEmpleado = i + 1; // fila real en la hoja (1-indexed)
      ultimoTipo = estadoData[i][1];
      break; // encontra, no sigue buscando
    }
  }
  // 2. Validar
  if (tipoEvento === "entrada" && ultimoTipo === "entrada") {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        message: "Ya tienes una entrada registrada hoy. Registra tu salida primero.",
        version: "0.0.2"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (tipoEvento === "salida" && ultimoTipo !== "entrada") {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        message: "No tienes una entrada registrada. Registra tu entrada primero.",
        version: "0.0.2"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // 3. Registrar en historial
  var fechaHora = new Date();
  var idFichaje = 'FICH-' + fechaHora.getTime();
  fichajes.appendRow([idFichaje, fechaHora, idEmpleado, tipoEvento]);

  // 4. Actualizar hoja de control
  if (filaEmpleado === -1) {
    // Empleado nuevo, agregar fila
    estado.appendRow([idEmpleado, tipoEvento, fechaHora]);
  } else {
    // Empleado existente, actualizar
    estado.getRange(filaEmpleado, 2).setValue(tipoEvento);
    estado.getRange(filaEmpleado, 3).setValue(fechaHora);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "Implementado", version: "0.0.2" }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. Guardar

Hacer clic en el ícono de disco (💾) o presionar `Ctrl + S`.

### 4. Desplegar como Web App

1. Hacer clic en **Desplegar** > **Nueva implementación**
2. Tipo: **Web App**
3. Descripción: `FichaDoor API`
4. Ejecutar como: **Yo** (tu cuenta)
5. Quién tiene acceso: **Cualquier persona**
6. Hacer clic en **Implementar**
7. **Copiar la URL** generada (algo como `https://script.google.com/macros/s/AKfycby-.../exec`)

### 5. Configurar la variable de entorno

Abrir el archivo `.env` en la raíz del proyecto y pegar la URL:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_SCRIPT_ID/exec
```

Reiniciar el servidor de desarrollo (`npm run dev`) para que tome los cambios.

---

## Generar credenciales QR

Cada operario necesita un código QR con su `idEmpleado`. Por ejemplo, para el operario `OP-014`, el QR debe contener exactamente el texto `OP-014`.

### Generar QR con la API de Google

Se puede generar un QR dinámico usando la API pública de QR Server. La URL es:

```
https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=OP-014
```

Reemplazar `OP-014` con el ID de cada operario.

### Mostrar el QR en la hoja de cálculo

En la hoja `Operarios`, se puede agregar una columna `Codigo_QR` con esta fórmula para visualizar el QR directamente en la celda:

```
=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" & A2)
```

Donde `A2` es la celda que contiene el `idEmpleado`. Esto genera el QR automáticamente para cada operario.

### Otras herramientas gratuitas

- [QR Code Generator](https://www.qrcode-generator.de/)
- [QR Code Monkey](https://www.qrcode-monkey.com/)

### Recomendaciones

- Imprimir las credenciales en material durable (laminado o plastificado)
- Tamaño mínimo recomendado: 3cm x 3cm
- Usar alto contraste (fondo blanco, código negro)
- Probar el escaneo antes de imprimir en masa

---

## Uso diario

### Flujo del operario

1. Llegar a la tablet
2. Seleccionar **Entrada** o **Salida**
3. Presionar **Escanear QR**
4. Presentar la credencial frente a la cámara
5. Esperar la confirmación

### Flujo del administrador

- **Agregar operario**: Agregar fila en la hoja `Operarios` con el ID y nombre
- **Ver historial**: Abrir la hoja `Fichajes_Raw` en Google Sheets
- **Ver estado actual**: Abrir la hoja `Estado_Fichajes`

---

## Comandos disponibles

```bash
npm run dev         # Servidor de desarrollo (solo local)
npm run dev:host    # Servidor accesible desde la red local
npm run build       # Build de producción (dist/)
npm run lint        # Verificar código con ESLint
npm run preview     # Preview del build de producción
```

---

## Probar en tablet o celular

1. Ejecutar `npm run dev:host`
2. Copiar la URL que aparece en `Network:` (ej: `https://192.168.100.4:5173`)
3. Abrir esa URL en el navegador del dispositivo
4. Aceptar el certificado de seguridad (es auto-firmado)
5. Listo para probar el escaneo

---

## Documentación

- [Google Sheets - Documentación oficial](https://support.google.com/docs/topic/9054603)
- [Google Apps Script - Documentación oficial](https://developers.google.com/apps-script)
- [html5-qrcode - Librería de escaneo QR](https://github.com/mebjas/html5-qrcode)
- [Vite - Documentación](https://vite.dev/)
- [React - Documentación](https://react.dev/)
- [Tailwind CSS - Documentación](https://tailwindcss.com/)

---

## Estructura del proyecto

```
attendance_control_QR_code/
├── index.html
├── package.json
├── vite.config.ts
├── .env                    # Variables de entorno (no se sube al repo)
├── .env.example            # Plantilla de variables de entorno
├── src/
│   ├── main.tsx            # Punto de entrada
│   ├── App.tsx             # Componente principal
│   └── index.css           # Estilos (Tailwind)
└── public/                 # Assets estáticos
```

---

## Solución de problemas

### La cámara no detecta el QR

La configuración de cámara en `App.tsx` incluye ajustes específicos para iOS 15+ (iPad):

```typescript
{ facingMode: { exact: "user" } }
{ fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }
```

- `{ exact: "user" }` en vez de `"user"` es necesario para que iOS acepte la restricción de cámara frontal.
- `aspectRatio: 1.0` evita que iOS falle silenciosamente en modo portrait.

En Android funciona sin problemas con la misma configuración. Si se modifica algo y falla en iPad, revisar que ambos parámetros estén presentes.

### Error de CORS

El Apps Script debe estar desplegado con acceso **"Cualquier persona"** (anónimo), no "Cualquier persona con cuenta de Google".

### El servidor no levanta con HTTPS

El plugin `basic-ssl` genera un certificado auto-firmado. En iPad, aceptar la excepción de seguridad cuando se accede por primera vez.

---

## Autor

**Kathe Guerrero** - [linktr.ee/kathe.systems](https://linktr.ee/kathe.systems)
