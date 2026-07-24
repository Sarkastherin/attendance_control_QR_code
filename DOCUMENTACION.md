# FichaDoor - Sistema de Control de Asistencia QR

Sistema de fichaje por código QR para registro de entrada y salida de operarios en planta industrial.

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Arquitectura](#2-arquitectura)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Flujo de uso](#4-flujo-de-uso)
5. [Lógica de validación](#5-lógica-de-validación)
6. [Estructura de Google Sheets](#6-estructura-de-google-sheets)
7. [Backend - Google Apps Script](#7-backend---google-apps-script)
8. [Frontend - React + Vite](#8-frontend---react--vite)
9. [Configuración y despliegue](#9-configuración-y-despliegue)
10. [Solución a problemas conocidos](#10-solución-a-problemas-conocidos)
11. [Características pendientes](#11-características-pendientes)

---

## 1. Descripción general

**FichaDoor** es una aplicación web que permite a los operarios de una fábrica registrar sus entradas y salidas escaneando un código QR con la cámara frontal de una tablet montada en la pared.

### Flujo básico

```
1. El administrador selecciona "Entrada" o "Salida"
2. Se abre la cámara frontal
3. El operario presenta su credencial QR
4. El sistema valida y registra el fichaje
5. Se muestra confirmación o rechazo
```

### Regla fundamental

> No puede haber dos eventos consecutivos del mismo tipo para un mismo empleado.
> Si hay una entrada, debe haber una salida, y viceversa.

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                    TABLET EN PLANTA                  │
│                                                      │
│  ┌──────────────┐         ┌──────────────────────┐  │
│  │   FichaDoor  │  GET    │  Google Apps Script  │  │
│  │   (React)    │────────▶│  (doGet)             │  │
│  │              │◀────────│                      │  │
│  └──────────────┘  JSON   └──────────┬───────────┘  │
│                                       │              │
└───────────────────────────────────────┼──────────────┘
                                        │
                                        ▼
                           ┌────────────────────────┐
                           │   Google Sheets         │
                           │                         │
                           │  ┌───────────────────┐  │
                           │  │  Fichajes_Raw      │  │
                           │  │  (historial)       │  │
                           │  └───────────────────┘  │
                           │  ┌───────────────────┐  │
                           │  │  Estado_Fichajes   │  │
                           │  │  (control rápido)  │  │
                           │  └───────────────────┘  │
                           └────────────────────────┘
```

### Componentes

| Componente | Tecnología | Función |
|-----------|-----------|---------|
| Frontend | React 19 + Vite 8 + Tailwind 4 | Interfaz de escaneo QR |
| Backend | Google Apps Script | API de validación y registro |
| Base de datos | Google Sheets | Almacenamiento de registros |
| Cámara | html5-qrcode | Acceso a cámara frontal del iPad |

---

## 3. Stack tecnológico

### Frontend

| Dependencia | Versión | Uso |
|------------|---------|-----|
| React | 19.2.7 | UI library |
| Vite | 8.1.1 | Build tool y dev server |
| Tailwind CSS | 4.3.3 | Estilos utility-first |
| html5-qrcode | 2.3.8 | Escaneo de códigos QR |
| TypeScript | 6.0.2 | Tipado estático |

### Backend

| Componente | Descripción |
|-----------|-------------|
| Google Apps Script | API REST desplegada como web app |
| Google Sheets | Base de datos relacional simple |

### Herramientas de desarrollo

| Herramienta | Versión |
|------------|---------|
| ESLint | 10.6.0 |
| React Compiler | 1.0.0 (babel plugin) |
| HTTPS local | @vitejs/plugin-basic-ssl |

---

## 4. Flujo de uso

### Flujo del operario

```
┌─────────────┐
│  Llegada    │
│  a planta   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Seleccionar    │
│  "Entrada"      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Presionar      │
│  "Escanear QR"  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐     ┌──────────────┐
│  Presentar      │     │  Cámara      │
│  credencial QR  │────▶│  frontal     │
│  frente a tablet│     └──────────────┘
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  QR detectado   │
│  → Envío a API  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐     ┌──────────────┐
│  ¿Válido?       │─NO─▶│  Mostrar     │
│                 │     │  rechazo     │
└──────┬──────────┘     └──────────────┘
       │SI
       ▼
┌─────────────────┐
│  Registrar      │
│  fichaje        │
│  ✓ Confirmar    │
└─────────────────┘
```

### Flujo de salida

Igual al de entrada, pero con el botón "Salida" seleccionado.

---

## 5. Lógica de validación

### Hoja de control: `Estado_Fichajes`

Esta hoja permite validaciones rápidas sin recorrer todo el historial.

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| A: `idEmpleado` | ID único del operario | `OP-014` |
| B: `ultimoTipo` | Último evento registrado | `entrada` / `salida` |
| C: `fechaUltimo` | Fecha y hora del último evento | `2026-07-24 06:00:00` |

### Reglas de validación

```
Si el empleado NO existe en Estado_Fichajes:
  → Permitir (es su primer registro)
  → Crear fila: [idEmpleado, tipoEvento, fechaHora]

Si el empleado SÍ existe:
  ├─ Si ultimoTipo === tipoEvento solicitado:
  │   → RECHAZAR ("Ya tienes una entrada/salida registrada")
  │
  └─ Si ultimoTipo !== tipoEvento solicitado:
      → PERMITIR
      → Actualizar fila: tipoEvento y fechaHora
```

### Mensajes de rechazo

| Escenario | Mensaje |
|-----------|---------|
| Doble entrada | "Ya tienes una entrada registrada hoy. Registra tu salida primero." |
| Salida sin entrada | "No tienes una entrada registrada. Registra tu entrada primero." |

---

## 6. Estructura de Google Sheets

### Spreadsheet principal: `Fichador`

#### Hoja: `Fichajes_Raw`

Registro completo de todos los fichajes.

| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| A: `idFichaje` | texto | ID único del fichaje | `FICH-1721836800000` |
| B: `fechaHora` | timestamp | Fecha y hora del evento | `2026-07-24 06:00:00` |
| C: `idEmpleado` | texto | ID del operario | `OP-014` |
| D: `tipoEvento` | texto | Tipo de evento | `entrada` / `salida` |

#### Hoja: `Estado_Fichajes`

Control rápido para validación (1 fila por empleado).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| A: `idEmpleado` | texto | ID del operario |
| B: `ultimoTipo` | texto | Último evento registrado |
| C: `fechaUltimo` | timestamp | Fecha/hora del último evento |

#### Hoja: `Ausencias_Justificadas` *(pendiente)*

| Columna | Tipo | Descripción |
|---------|------|-------------|
| A: `idEmpleado` | texto | ID del operario |
| B: `nombre` | texto | Nombre completo |
| C: `fechaDesde` | fecha | Inicio de ausencia |
| D: `fechaHasta` | fecha | Fin de ausencia |
| E: `tipo` | texto | Vacaciones / Licencia médica / Permiso / Licencia especial |
| F: `motivo` | texto | Descripción |
| G: `registradoPor` | texto | Quien lo registró |
| H: `fechaRegistro` | timestamp | Cuándo se registró |

#### Hoja: `Calendario_Laboral` *(pendiente)*

| Columna | Tipo | Descripción |
|---------|------|-------------|
| A: `fecha` | fecha | Fecha completa |
| B: `tipo` | texto | Feriado / Dia_laborable / Fin_de_semana |
| C: `descripcion` | texto | Nombre del feriado |

#### Hoja: `Resumen_Presentismo` *(pendiente)*

| Columna | Tipo | Descripción |
|---------|------|-------------|
| A: `año` | número | Año |
| B: `mes` | número | Mes (1-12) |
| C: `idEmpleado` | texto | ID del operario |
| D: `nombre` | texto | Nombre |
| E: `diasLaborables` | número | Días laborables del mes |
| F: `diasTrabajados` | número | Días con registro |
| G: `ausenciasJustificadas` | número | Días justificados |
| H: `ausenciasInjustificadas` | número | Días sin justificación |
| I: `permisos` | número | Permisos especiales |
| J: `porcentajeAusentismo` | texto | Porcentaje de ausentismo |

### Estructura en Google Drive

```
Carpeta del proyecto/
├── Fichador (spreadsheet principal)
│   ├── Fichajes_Raw
│   ├── Estado_Fichajes
│   ├── Ausencias_Justificadas     ← pendiente
│   ├── Calendario_Laboral         ← pendiente
│   └── Resumen_Presentismo        ← pendiente
│
└── Historial/                     ← pendiente
    ├── Fichajes_2026.xlsx
    │   ├── Enero
    │   ├── Febrero
    │   └── ...
    └── Fichajes_2027.xlsx
```

---

## 7. Backend - Google Apps Script

### Despliegue

- **Tipo**: Web App (doGet)
- **Ejecutar como**: Yo (propietario del spreadsheet)
- **Acceso**: Cualquier persona (anónimo)
- **URL**: `https://script.google.com/macros/s/AKfycby-.../exec`

### Función: `doGet(e)`

Maneja las peticiones de fichaje vía HTTP GET.

#### Parámetros de entrada

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `qrId` | string | Sí | ID del empleado (contenido del QR) |
| `tipoEvento` | string | Sí | `entrada` o `salida` |

#### Respuesta exitosa

```json
{
  "ok": true,
  "message": "Implementado",
  "version": "0.0.2"
}
```

#### Respuesta de rechazo

```json
{
  "ok": false,
  "message": "Ya tienes una entrada registrada hoy. Registra tu salida primero.",
  "version": "0.0.2"
}
```

#### Flujo interno

```
1. Validar parámetros (qrId y tipoEvento)
2. Buscar empleado en Estado_Fichajes
3. Validar regla de negocio:
   - No permitir entrada si ya hay entrada registrada
   - No permitir salida si no hay entrada previa
4. Registrar en Fichajes_Raw:
   - idFichaje: "FICH-" + timestamp
   - fechaHora: new Date()
   - idEmpleado: parámetro
   - tipoEvento: parámetro
5. Actualizar Estado_Fichajes:
   - Si es nuevo: agregar fila
   - Si existe: actualizar tipo y fecha
6. Retornar resultado
```

### Código fuente del doGet

```javascript
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var fichajes = sheet.getSheetByName("Fichajes_Raw");
  var estado = sheet.getSheetByName("Estado_Fichajes");

  const idEmpleado = e.parameter.qrId;
  const tipoEvento = e.parameter.tipoEvento;

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
      filaEmpleado = i + 1;
      ultimoTipo = estadoData[i][1];
      break;
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
    estado.appendRow([idEmpleado, tipoEvento, fechaHora]);
  } else {
    estado.getRange(filaEmpleado, 2).setValue(tipoEvento);
    estado.getRange(filaEmpleado, 3).setValue(fechaHora);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: "Implementado", version: "0.0.2" }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Menú personalizado *(pendiente)*

```
FichaDoor (menú)
├── 📋 Validar mes
├── 📦 Cerrar mes
├── ➕ Registrar ausencia
├── 📅 Gestionar calendario
└── 📊 Generar resumen de presentismo
```

---

## 8. Frontend - React + Vite

### Estructura del proyecto

```
attendance_control_QR_code/
├── index.html              ← Entry point HTML
├── package.json            ← Dependencias y scripts
├── vite.config.ts          ← Configuración de Vite
├── .env                    ← Variables de entorno (no se sube al repo)
├── .env.example            ← Plantilla de variables de entorno
├── DOCUMENTACION.md        ← Este archivo
├── src/
│   ├── main.tsx            ← Punto de entrada React
│   ├── App.tsx             ← Componente principal (toda la app)
│   └── index.css           ← Estilos (Tailwind)
├── public/                 ← Assets estáticos
└── dist/                   ← Build de producción
```

### Componente principal: `App.tsx`

La aplicación completa está en un solo componente.

#### Estados

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `state` | `"idle" \| "scanning" \| "error"` | Estado del scanner |
| `tipoEvento` | `"entrada" \| "salida" \| null` | Tipo de fichaje seleccionado |
| `scannedResult` | string | Texto decodificado del QR |
| `sendStatus` | `"idle" \| "sending" \| "sent" \| "error" \| "rejected"` | Estado del envío |
| `serverMessage` | string | Mensaje del servidor |

#### Funciones principales

| Función | Descripción |
|---------|-------------|
| `startScanning()` | Inicia la cámara frontal y escaneo QR |
| `stopScanner()` | Detiene la cámara |
| `sendToSheet(qrId, tipo)` | Envía el fichaje al Apps Script |
| `selectTipo(tipo)` | Selecciona entrada o salida |
| `resetAll()` | Resetea todo el estado |

#### Configuración de cámara (iPad)

```typescript
{
  facingMode: { exact: "user" },  // Cámara frontal (forzado)
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0               // Fix para iPad portrait
}
```

### Diseño visual

| Elemento | Estilo |
|----------|--------|
| Fondo | `bg-gray-950` (casi negro) |
| Título | Space Grotesk + Dancing Script (puerta) |
| Botón Entrada | Verde (`bg-green-600`) |
| Botón Salida | Rojo (`bg-red-600`) |
| Botón Escanear | Azul (`bg-blue-600`) |
| Scanner QR | Borde redondeado, fondo gris oscuro |

---

## 9. Configuración y despliegue

### Requisitos previos

- Node.js 18+
- Cuenta de Google con acceso a Google Sheets
- Tablet con cámara frontal (iPad recomendado)

### Instalación local

```bash
# Clonar repositorio
git clone <url-del-repositorio>
cd attendance_control_QR_code

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con la URL real del Apps Script

# Iniciar servidor de desarrollo
npm run dev
```

### Build de producción

```bash
npm run build
```

Los archivos se generan en `dist/`.

### Despliegue del Apps Script

1. Abrir [script.google.com](https://script.google.com)
2. Crear nuevo proyecto o abrir el existente
3. Pegar el código de `doGet(e)` (ver sección 7)
4. Desplegar > Nueva implementación
5. Tipo: Web App
6. Ejecutar como: Yo
7. Acceso: Cualquier persona
8. Copiar la URL generada
9. Pegar en `VITE_APPS_SCRIPT_URL` en `.env`

### Variables de entorno

| Variable | Archivo | Descripción |
|----------|---------|-------------|
| `VITE_APPS_SCRIPT_URL` | `.env` | URL del endpoint de Apps Script |

---

## 10. Solución a problemas conocidos

### iPad no detecta QR (resuelto)

**Problema**: El iPad no detecta códigos QR con la cámara frontal, sin mostrar errores.

**Causa**: Restricciones de iOS 15 con `facingMode` y dimensiones del área de escaneo.

**Solución aplicada**:

```typescript
// Antes (no funcionaba en iPad)
{ facingMode: "user" }
{ fps: 10, qrbox: { width: 250, height: 250 } }

// Después (funciona en iPad)
{ facingMode: { exact: "user" } }
{ fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }
```

**Cambios clave**:
- `facingMode: { exact: "user" }` en vez de `"user"` (restricción estricta)
- `aspectRatio: 1.0` (fix para iPad portrait mode)

### CORS con POST (resuelto)

**Problema**: Las peticiones POST a Apps Script fallan por CORS.

**Solución**: Usar GET con parámetros en la query string.

---

## 11. Características pendientes

### Corto plazo

- [ ] Menú personalizado en Apps Script
- [ ] Función `validarMes()` - Validar registros incompletos
- [ ] Función `cerrarMes()` - Archivar mes y limpiar Fichajes_Raw
- [ ] Hoja `Ausencias_Justificadas`
- [ ] Hoja `Calendario_Laboral` con feriados argentinos
- [ ] Función `registrarAusencia()`

### Mediano plazo

- [ ] Función `generarResumenPresentismo()`
- [ ] Hoja `Resumen_Presentismo` para dashboards
- [ ] Carpeta `Historial/` en Google Drive
- [ ] Archivos anuales de fichajes archivados

### Largo plazo

- [ ] Cálculo de horas regulares vs extras
- [ ] Redondeo de horas a bloques de 30 minutos (método truncado)
- [ ] Conexión con Looker Studio para reportes
- [ ] Dashboard de ausentismo mensual/anual

---

## Información del proyecto

| Campo | Valor |
|-------|-------|
| Nombre | FichaDoor |
| Versión | 0.0.0 (package.json) |
| Autor | Kathe Guerrero |
| Enlace | [linktr.ee/kathe.systems](https://linktr.ee/kathe.systems) |
| Última actualización | Julio 2026 |
