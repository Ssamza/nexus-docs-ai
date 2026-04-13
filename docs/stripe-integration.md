# Stripe Integration — Plan de implementación

## Stack
- **Stripe Billing** — suscripciones, cancelaciones, reintentos automáticos
- **Wise** — cuenta USD para recibir pagos desde Stripe (no hay pago directo a Colombia)
- **Stripe Webhooks** — sincronizar estado del plan en la DB

## Costo por transacción ($2.99/mes)
| Concepto | Valor |
|---|---|
| Stripe fee | $0.39 (2.9% + $0.30 USD) |
| Wise conversión USD→COP | ~$0.02 |
| **Neto recibido** | **~$2.58** |

---

## Variables de entorno a agregar

```env
# apps/server/.env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_PRICE_ID=price_...   # ID del precio mensual en Stripe Dashboard

# apps/web/.env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## Pasos de implementación

### 1. Stripe Dashboard
- Crear producto "NexusDocs AI Premium"
- Crear precio recurrente: $2.99 USD/mes y $1.99 USD/mes (anual = $23.88)
- Copiar los `price_id` de cada precio al `.env`
- Configurar webhook endpoint: `https://tu-dominio.com/api/stripe/webhook`
- Eventos a escuchar:
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `customer.subscription.updated`
  - `invoice.payment_failed`

### 2. Instalar dependencias

```bash
cd apps/server && pnpm add stripe
cd apps/web && pnpm add @stripe/stripe-js
```

### 3. Backend — `apps/server/src/lib/stripe.ts`

```typescript
import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});
```

### 4. Backend — `apps/server/src/routes/stripe.ts`

Dos endpoints:

#### POST `/api/stripe/checkout`
Crea una Checkout Session y devuelve la URL al frontend.
```typescript
router.post("/checkout", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { priceId } = req.body; // monthly o annual price ID

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: user.email,
    metadata: { userId: user.id },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.WEB_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.WEB_URL}/pricing`,
  });

  res.json({ url: session.url });
});
```

#### POST `/api/stripe/webhook`
Recibe eventos de Stripe y actualiza el plan en la DB.
```typescript
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"]!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    res.status(400).json({ error: "Webhook signature invalid" });
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.CheckoutSession;
      const userId = session.metadata?.userId;
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: "PREMIUM", stripeCustomerId: session.customer as string },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.user.update({
        where: { stripeCustomerId: sub.customer as string },
        data: { plan: "REGISTERED" },
      });
      break;
    }
    case "invoice.payment_failed": {
      // Opcional: enviar email de aviso, no bajar el plan inmediatamente
      // Stripe reintenta automáticamente antes de cancelar
      break;
    }
  }

  res.json({ received: true });
});
```

> **Importante:** el webhook debe registrarse en `index.ts` ANTES del middleware `express.json()` porque necesita el body raw:
> ```typescript
> app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
> app.use(express.json({ limit: "1mb" }));
> ```

### 5. Schema Prisma — agregar `stripeCustomerId`

```prisma
model User {
  // ... campos existentes
  stripeCustomerId String? @unique
}
```

Correr migración:
```bash
cd apps/server && npx prisma migrate dev --name add-stripe-customer-id
```

### 6. Frontend — botón "Hazte Premium"

En `apps/web/src/app/pricing/page.tsx`, el botón actual es estático. Reemplazarlo por:

```typescript
async function handleUpgrade(priceId: string) {
  const token = await getToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ priceId }),
  });
  const { url } = await res.json();
  window.location.href = url; // redirige a Stripe Checkout
}
```

Si el usuario no está logueado, redirigir primero a `/sign-up?redirect=/pricing`.

### 7. Portal de cliente (cancelación)

Stripe tiene un portal listo para que el usuario cancele o cambie su plan sin que tengas que construirlo:

```typescript
router.post("/portal", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.WEB_URL}/dashboard`,
  });
  res.json({ url: session.url });
});
```

Agregar un botón "Gestionar suscripción" en el dashboard para usuarios Premium.

---

## Testing local

Stripe tiene un CLI para simular webhooks en local:

```bash
# Instalar Stripe CLI
stripe listen --forward-to localhost:3001/api/stripe/webhook

# Simular un pago exitoso
stripe trigger checkout.session.completed
```

Usar tarjeta de prueba: `4242 4242 4242 4242` con cualquier fecha futura y CVC.

---

## Checklist antes de ir a producción

- [ ] Wise: abrir cuenta, obtener número de cuenta USD, conectar a Stripe
- [ ] Stripe: cambiar de modo test a live, copiar nuevas keys al `.env` de producción
- [ ] Configurar webhook en Stripe Dashboard apuntando al dominio real
- [ ] Probar flujo completo: pago → plan actualizado → cancelación → plan bajado
- [ ] Agregar botón "Gestionar suscripción" en dashboard para usuarios Premium
