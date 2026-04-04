# Cómo funciona NexusDocs AI

Guía completa de todos los servicios y cómo se conectan entre sí.

---

## Vista general

NexusDocs AI es un asistente legal colombiano. El usuario puede hacer preguntas sobre derecho laboral e impuestos, y la app responde basándose en leyes reales (pre-cargadas) y en documentos personales que el usuario sube (contratos, colillas de pago).

Hay **6 servicios** trabajando juntos:

```
Usuario
  │
  ▼
Next.js (interfaz web)
  │
  ▼
Express API (cerebro de la app)
  ├── Clerk        → ¿quién eres?
  ├── Voyage AI    → entender el significado de textos
  ├── PostgreSQL   → guardar todo (usuarios, documentos, vectores, historial)
  ├── MinIO        → guardar los archivos PDF originales
  └── Claude       → generar la respuesta final
```

Docker corre PostgreSQL, MinIO y n8n localmente en tu máquina.
n8n es una herramienta de automatización (para futuras integraciones con Notion).

---

## 1. Docker — la infraestructura local

**¿Qué es?**
Docker es un sistema que corre aplicaciones aisladas en "contenedores". En lugar de instalar PostgreSQL y MinIO directamente en tu computador, Docker los corre en cajas virtuales independientes.

**¿Qué corre en Docker en este proyecto?**

```
docker-compose.yml
    │
    ├── postgres    → base de datos (puerto 5433)
    ├── minio       → almacenamiento de archivos (puerto 9000)
    └── n8n         → automatizaciones (puerto 5678)
```

**¿Por qué Docker y no instalar directamente?**
- Un solo comando (`docker compose up -d`) levanta todo
- No ensucia tu sistema con instalaciones
- En producción, los mismos contenedores corren en el servidor sin cambios

---

## 2. PostgreSQL + pgvector — la base de datos

**¿Qué es PostgreSQL?**
Es la base de datos principal. Guarda usuarios, documentos, conversaciones, mensajes y el cache de preguntas.

**¿Qué es pgvector?**
Es una extensión de PostgreSQL que le agrega la capacidad de guardar y buscar **vectores numéricos**. Un vector es una lista de 512 números que representa el significado de un texto.

Sin pgvector, la búsqueda sería por palabras exactas ("vacaciones"). Con pgvector, la búsqueda es por significado — encuentra fragmentos sobre "descanso remunerado anual" aunque no contengan la palabra "vacaciones".

**¿Qué guarda la base de datos?**

```
User              → cuenta del usuario (email, plan: free/registered/premium)
Document          → cada PDF subido (título, contenido, si es ley pública o doc personal)
DocumentChunk     → fragmentos del documento + su vector (512 números)
Conversation      → hilo de chat
Message           → cada mensaje del hilo (usuario o asistente)
QueryCache        → preguntas frecuentes + respuesta guardada (para no llamar a Claude cada vez)
```

**¿Cómo se accede?**
A través de Prisma (ver sección 3).

---

## 3. Prisma — el traductor entre código y base de datos

**¿Qué es?**
Prisma es el ORM (Object-Relational Mapper). En lugar de escribir SQL a mano, escribes código TypeScript y Prisma lo traduce a SQL automáticamente.

**Ejemplo:**
```ts
// Sin Prisma (SQL crudo):
"SELECT * FROM User WHERE clerkId = 'user_123'"

// Con Prisma:
prisma.user.findUnique({ where: { clerkId: 'user_123' } })
```

**¿Dónde vive la configuración?**
`apps/server/prisma/schema.prisma` — ahí están definidos todos los modelos (tablas).

**¿Qué son las migraciones?**
Cada vez que cambias el schema (agregas una tabla, un campo) se genera un archivo SQL en `prisma/migrations/`. Ese archivo registra exactamente qué cambió y en qué orden. Así la base de datos siempre está sincronizada con el código.

---

## 4. Clerk — la autenticación

**¿Qué es?**
Clerk es un servicio de autenticación completo. Maneja registro, login, sesiones y JWT. No necesitas implementar nada de eso desde cero.

**¿Cómo funciona en esta app?**

```
Usuario abre la app
    │
    ├── Sin cuenta → Clerk asigna un ID anónimo (guardado en localStorage)
    │                Puede hacer 5 preguntas/día, subir 1 documento
    │
    └── Con cuenta → Clerk genera un JWT (token firmado)
                     El servidor lo verifica en cada request
                     Puede hacer 20 preguntas/día, guardar 5 documentos
```

**¿Dónde vive la lógica?**
`apps/server/src/middleware/auth.ts` — el middleware `resolveIdentity` lee el JWT de Clerk en cada request, busca o crea el usuario en la base de datos, y adjunta sus límites de plan.

**¿Qué son los límites de plan?**
`apps/server/src/lib/limits.ts` define cuántos documentos y preguntas permite cada plan. El middleware los adjunta al request y las rutas los consultan antes de procesar.

---

## 5. MinIO — el almacenamiento de archivos

**¿Qué es?**
MinIO es un servicio de almacenamiento compatible con S3 (el servicio de archivos de Amazon). Guarda los PDFs originales que suben los usuarios.

**¿Por qué guardar el PDF original si ya se procesó el texto?**
Para que el usuario pueda descargar su documento original desde la app. El texto extraído del PDF se guarda en PostgreSQL para búsquedas, pero el PDF bonito con su formato original vive en MinIO.

**¿Cómo funciona?**

```
Usuario sube PDF
    │
    ├── PDF original → MinIO (guardado con una clave única)
    └── Texto extraído → PostgreSQL (para búsquedas y embeddings)

Usuario pide descargar su documento
    │
    └── Se genera una URL firmada (válida 5 minutos) que apunta a MinIO
        El usuario descarga directamente desde MinIO
```

**¿Dónde vive la lógica?**
`apps/server/src/lib/storage.ts`

---

## 6. Voyage AI — convertir texto en vectores

**¿Qué es?**
Voyage AI es un servicio especializado en crear embeddings — vectores numéricos que representan el significado de un texto.

**¿Por qué no usar directamente palabras clave?**
Porque la búsqueda por palabras exactas es frágil. Si la ley dice "descanso remunerado" y el usuario pregunta "vacaciones", una búsqueda normal no encuentra nada. Voyage AI convierte ambos textos a vectores similares porque significan lo mismo.

**¿Cómo funciona un vector?**
```
"vacaciones anuales"         → [0.23, -0.87, 0.11, 0.54, ... 512 números]
"descanso remunerado anual"  → [0.21, -0.89, 0.09, 0.57, ... 512 números]
                                 ↑ muy similares = mismo significado
```

PostgreSQL con pgvector compara estos vectores y devuelve los más cercanos.

**¿Cuándo se llama a Voyage AI?**

| Momento | Para qué | Costo |
|---|---|---|
| Ingesta de documentos | Convertir cada fragmento en vector (una sola vez) | ~$0.026 total |
| Cada consulta del usuario | Convertir la pregunta en vector | ~$0.000002 |

**¿Qué es el batch de embeddings?**
Voyage AI puede recibir hasta 128 textos en una sola llamada. En lugar de hacer 400 llamadas para un documento de 400 fragmentos, se hacen 4 llamadas con 100 textos cada una. Es mucho más rápido y evita los límites de velocidad.

---

## 7. Claude (Anthropic) — generar la respuesta

**¿Qué es?**
Claude es el modelo de IA que genera las respuestas en lenguaje natural. Es el último paso del proceso.

**¿Qué recibe Claude en cada consulta?**

```
1. System prompt   → instrucciones fijas: "responde en español,
                      cita normas, no inventes datos..."

2. Historial       → los últimos 8 mensajes del hilo
                      (para recordar el contexto de la conversación)

3. Contexto        → los 4-6 fragmentos de documentos más relevantes
                      encontrados por pgvector

4. Pregunta        → lo que escribió el usuario
```

**¿Por qué Claude no tiene los documentos "aprendidos"?**
Porque Claude no tiene memoria entre sesiones y no fue entrenado con las leyes colombianas específicas. Por eso se le pasan los fragmentos relevantes en cada consulta — es como darle las páginas del libro justo antes de hacerle la pregunta.

---

## 8. n8n — automatizaciones

**¿Qué es?**
n8n es una herramienta de automatización visual (similar a Zapier). Permite conectar servicios sin escribir código mediante flujos visuales.

**¿Para qué se usa en este proyecto?**
Actualmente tiene un workflow de sincronización con Notion (`n8n/workflows/notion-sync.json`). El flujo es:

```
Página de Notion actualizada
    │
    ▼
n8n extrae el texto de los bloques de Notion
    │
    ▼
POST /api/ingest/legal → Express API
    │
    ▼
Se re-embeden los fragmentos actualizados en pgvector
```

**¿Por qué n8n y no código directo?**
Para el feature premium de "documentos legales actualizados automáticamente cuando cambia la ley" — cuando la DIAN actualice el Estatuto Tributario, n8n detecta el cambio en Notion y re-ingesta el documento sin intervención manual.

---

## El flujo completo de una consulta

```
┌─────────────────────────────────────────────────────────────────┐
│  Usuario escribe: "¿Cuántos días de vacaciones me corresponden?" │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Next.js       │  Envía la pregunta al API
                    │   (frontend)    │  con el token de Clerk
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Clerk (auth)   │  Verifica quién es el usuario
                    │                 │  Aplica límites de plan
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Cache check    │  ¿Alguien ya preguntó esto?
                    │  (pgvector)     │  → SÍ: devuelve respuesta guardada
                    └─────────────────┘  → NO: continúa
                              │
                              ▼
                    ┌─────────────────┐
                    │   Voyage AI     │  Convierte la pregunta en vector
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   pgvector      │  Busca los 6 fragmentos más
                    │  (PostgreSQL)   │  similares de las leyes
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │     Claude      │  Genera respuesta con contexto
                    │  (Anthropic)    │  + historial + fragmentos legales
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │  Guarda pregunta + respuesta
                    │   (Prisma)      │  en Conversation/Message
                    └─────────────────┘
                              │
                              ▼
              "Según el artículo 186 del CST, tienes
               derecho a 15 días hábiles de vacaciones..."
```

---

## El flujo de ingesta de documentos legales

```
┌──────────────────────────────────────────┐
│  pnpm run ingest-legal  (una sola vez)   │
└──────────────────────────────────────────┘
                    │
          Para cada PDF en /legal-docs:
                    │
                    ▼
          ┌─────────────────┐
          │   pdf-parse     │  Extrae texto del PDF
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  chunkText()    │  Divide en fragmentos de ~2000 caracteres
          │                 │  (el CST queda en ~400 fragmentos)
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │   Voyage AI     │  Convierte hasta 128 fragmentos por llamada
          │  (embedBatch)   │  → cada fragmento = 512 números
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │   PostgreSQL    │  Guarda fragmento + vector
          │  (DocumentChunk)│  isPublicKnowledge = true
          └─────────────────┘

Total: ~1,300 fragmentos, ~$0.026, ~5 minutos
```

---

## Resumen de qué hace cada servicio

| Servicio | Rol | Cuándo se usa |
|---|---|---|
| **Docker** | Corre la infraestructura local | Siempre (en background) |
| **PostgreSQL** | Guarda todo: usuarios, docs, vectores, historial | En cada operación |
| **pgvector** | Busca fragmentos por similitud de significado | En cada consulta |
| **Prisma** | Traduce código TypeScript a SQL | En cada operación |
| **Clerk** | Identifica al usuario y su plan | En cada request |
| **MinIO** | Guarda los PDFs originales | Al subir y descargar |
| **Voyage AI** | Convierte texto en vectores numéricos | Al ingestar y al consultar |
| **Claude** | Genera la respuesta final en lenguaje natural | En cada consulta (si no hay cache) |
| **n8n** | Automatiza actualizaciones de documentos legales | Cuando cambia una ley |
