# Sweep — eliminación del modelo de comisiones anterior

Fecha: 2026-07-14

## Greps ejecutados

```
grep -rn "0\.05\|1\.05\|marketplace_fee\|application_fee\|net_amount\|PLATFORM_FEE\|COMMISSION_RATE\|SERVICE_FEE\|TOURNAMENT_PLATFORM_FEE\|comisionPlataforma\|platform_fee\|match_fee" --include="*.ts" --include="*.tsx" .

grep -rn "comisión\|comision\|commission\|5%\|1\.000 ARS\|1000 ARS" --include="*.ts" --include="*.tsx" --include="*.json" .
```

Resultados completos mostrados en el chat antes de modificar nada.

## Exclusiones explícitas del usuario

No se tocó nada relacionado a `lib/offline-payments.ts` ni `lib/mp-practice-preference.ts` (modelo de comisión de clases/efectivo-transferencia offline — candidatos a un sweep separado).

## Base de datos

Se buscaron tablas `app_config`/`settings`/`constants`/`platform_config` y columnas `commission`/`fee_rate`/`platform_fee` en todo el esquema `public`. **No existe ninguna.** No se generó migración.

## Archivos modificados

| Archivo | Qué se encontró | Qué se cambió |
|---|---|---|
| `lib/admin/finance-math.ts` | `PADELIBRE_FEE_MULTIPLIER = 1.05` aplicado en todas las funciones de agregación (sumByCourt, totalPaid, sumInRange, aggregateByDay/Week/Month) | Se eliminó la constante y `withPadelibreFee()`; ahora usan `total_price` directo |
| `app/admin/finanzas/finance-module.tsx` | Dos cálculos inline `total_price * 1.05` (ingreso semanal, cancha top del mes) | Se sacó el `* 1.05` en ambos. **No se tocó** la sección "Saldo deudor con PadeLibre" (5% en efectivo/transferencia) — depende de `club_debts`, excluida |
| `app/admin/cobros/page.tsx` | `Math.round(total_price / 4 * 1.05)` en la lista de pagos pendientes | Ahora muestra `total_price` directo. **No se tocó** la línea 308 ("comisión de servicio" en el contexto de deuda offline) — excluida |
| `app/(player)/partidos/[id]/page.tsx` | 5 cálculos `* 1.05` / `/4 * 1.05` (precio por jugador, precio total, mensaje de WhatsApp); bloque "Confirmá tu lugar pagando tu parte del turno"; props muertas `pricePerPlayer/clubHasMp/clubAcceptsCash/clubAcceptsTransfer` pasadas a `JoinMatchPaymentModal` | Se sacó el `*1.05` en los 5 lugares; se reescribió el texto del bloque de invitación ("Sumate cuando quieras. El pago lo coordinás con el organizador" + botón "Unirme al partido"); se simplificaron los 2 call-sites del modal; se sacaron las 3 variables que quedaron sin uso |
| `components/join-match-payment-modal.tsx` | Modal completo con selector de método de pago (MP/transferencia/efectivo) y "Tu parte (1/4 del total)" para unirse a un partido — pero el endpoint al que llama (`/api/partidos/[id]/join`) ya une gratis sin mirar el método desde el refactor de CASO 2 | Reescrito: sin selector de pago ni precio, solo confirmación de unión gratuita |
| `app/(player)/perfil/actividad/activity-tabs.tsx` | `item.total_price * 1.05` | Se sacó el `*1.05` |
| `app/(player)/reservas/page.tsx` | `Number(row.total_price) * 1.05` | Se sacó el `*1.05` |
| `components/open-matches-board.tsx` | `turnTotalWithFee = turnTotal * 1.05` y cálculo de `joinShare` (costo por jugador al unirse) | Se eliminó todo el cálculo — unirse ya no tiene costo |
| `components/matches-filter-board.tsx` | Campo `joinShare` en el tipo + bloque UI "Costo para unirse: $X" en las tarjetas de partidos | Se sacó el campo del tipo, el bloque UI, y el import `CreditCard` que quedó sin uso |
| `app/superadmin/(main)/page.tsx` | `total_price * 1.05` en ingresos pagados | Se sacó el `*1.05` |
| `app/superadmin/(main)/clubes/[id]/page.tsx` | `total_price * 1.05` en el historial de turnos del club | Se sacó el `*1.05` |
| `app/admin/reservas/page.tsx` | `marketplace_fee` en el select y tipo de "Pagos registrados" (nunca se renderizaba) | Se sacó el campo del select y del tipo |
| `app/admin/turnos-fijos/actions.ts` | `marketplace_fee: 0` en un insert a `payments` | Se sacó el campo (la columna tiene default 0) |
| `lib/fixed-slot-generator.ts` | `marketplace_fee: 0` en un insert a `payments` | Se sacó el campo |
| `app/api/mp/create-preference/route.ts` | Endpoint huérfano (sin llamadores, confirmado en un prompt anterior) con lógica completa del modelo viejo: `MP_MARKETPLACE_FEE`, `marketplace_fee` en el body de la preferencia | **Archivo eliminado** |
| `app/superadmin/(main)/finanzas/page.tsx` | `feeRate()`/`MP_MARKETPLACE_FEE`, `mpMonthTotal`/`mpHistoricTotal` (ingresos de PadeLibre por el 5% de MP), columna "Comisión" en la tabla de historial | Se eliminó todo el tracking de comisión de MP y la columna de la tabla; se actualizó el texto del header. **No se tocó** la sección "Deudas por club" (`club_debts`, efectivo/transferencia) — excluida, depende de `offline-payments.ts` |
| `app/superadmin/(main)/usuarios/[id]/page.tsx` | `marketplace_fee` en select, tipo, y como "com. $X" junto a cada pago | Se sacó de los 3 lugares |
| `app/api/ai/chat/route.ts` | 3 respuestas explícitamente pedidas (`como_pago`, `cuanto_pago`, `comision_servicio`) con 5%/comisión/split "1/4 + comisión"; además otras 7 respuestas (`cuando_cobran`, `crear_partido`, `unirse_partido`, `cancelar_partido`, `reserva_no_aparece`, `pago_efectivo_transferencia`, `confirmar_transferencia`) describían el modelo viejo de "pagá tu parte al unirte" / "los 4 jugadores deben pagar", ya inválido desde el refactor de CASO 2 (unirse es gratis) | Las 3 pedidas se reemplazaron según el criterio dado ("El club puede requerir una seña... El monto lo define cada club"); las otras 7 se reescribieron para reflejar que solo el organizador paga (seña o nada) y unirse no tiene costo |
| `app/admin/config/mp-connect/page.tsx` | 3 pasos del "¿Cómo funciona?" y el texto legal al pie describían el split viejo (jugador paga turno + 5%, MP separa automáticamente, comisión del 5% por reserva) | Reescritos para reflejar seña opcional configurable por cancha y 0% de comisión |

## Grep matcheó pero NO se modificó (con motivo)

| Archivo | Motivo |
|---|---|
| `lib/offline-payments.ts` | Exclusión explícita del usuario |
| `lib/mp-practice-preference.ts` | Exclusión explícita del usuario |
| `lib/practice-pricing.ts`, `lib/practice-constants.ts`, `lib/practice-offline.ts` | Mismo modelo de comisión que `mp-practice-preference.ts` (clases) — se interpretó como incluido en la exclusión por ser el mismo feature. Si esto no era lo que querías decir, avisame y lo sumo a este sweep |
| `app/(player)/clases/[sessionId]/page.tsx`, `app/admin/clases/page.tsx`, `app/admin/clases/[id]/page.tsx` | Feature de clases, depende de `mp-practice-preference.ts` — mismo motivo que arriba |
| `app/admin/cobros/actions.ts` | Importa `clubPadelibreDebtFromTurn`/`playerShareWithMarketplaceFee` directamente de `lib/offline-payments.ts` — excluido |
| `app/admin/cobros/page.tsx:308` | Describe la deuda con PadeLibre por efectivo/transferencia (`club_debts`), generada por el código excluido |
| `app/admin/finanzas/finance-module.tsx:520,565` | Sección "Saldo deudor con PadeLibre" — mismo `club_debts`, excluida |
| `app/superadmin/actions.ts:182` | Notificación de deuda por `club_debts` — mismo motivo |
| `app/(player)/legal/terminos/page.tsx` | Términos y condiciones legales. No lo reescribí solo porque matcheó el grep — un cambio de términos legales debería revisarlo alguien con criterio legal, no reescribirse solo automáticamente |
| `app/(player)/sobre-padelibre/page.tsx` | Página de marketing "sobre nosotros", fuera del alcance de "checkout" que definiste en la sección 2 |
| `lib/legal-documents.ts` | Texto legal ("Split Payment") que alimenta la página de términos — mismo motivo que `legal/terminos` |
| `app/admin/facturacion/page.tsx:41` | "Sin comisiones por uso" — ya es el texto correcto (lo escribí yo en un prompt anterior), falso positivo |
| `lib/mp-preference.ts:14` | Comentario que dice "no hay marketplace_fee" — ya está limpio, falso positivo |
| `components/admin/admin-back-link.tsx`, `admin/reservas/manual-block-fab.tsx`, `components/clubs-list-client.tsx`, `components/onboarding-slides.tsx`, `components/profile/level-evolution-chart.tsx`, `components/chat-thread.tsx`, `components/competitive-result-confirmation-card.tsx`, `components/match-chat.tsx`, `components/skeleton.tsx`, `app/(player)/perfil/partidos/page.tsx` | Todos son valores de Tailwind/CSS/animación (`hover:scale-[1.05]`, `opacity 0.05`, `staggerChildren 0.05`, breakpoints `5%`/`15%`/`55%`) — no tienen relación con comisiones, falsos positivos puros |
| `node_modules/**` | Tipos del SDK de `mercadopago` y librerías de terceros — no es código del proyecto |

## Validación

`npx tsc --noEmit` y `npm run build` corrieron limpios después de todos los cambios (se limpió `.next/` una vez por cache stale de las rutas eliminadas en un prompt anterior).
