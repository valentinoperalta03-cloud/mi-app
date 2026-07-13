-- confirm_participant_payment_atomic implementaba el modelo viejo (4 pagos
-- individuales por partido). El webhook de MP (app/api/mp/webhook/route.ts)
-- dejo de invocarla al migrar al modelo de senas: bajo el modelo nuevo el
-- pago via MP es siempre el del organizador, y esta funcion solo marcaba el
-- partido como pagado cuando habia 4 pagos aprobados, condicion que ya nunca
-- se cumple. No hay triggers ni RPCs que la referencien.
drop function if exists public.confirm_participant_payment_atomic(uuid, uuid, text);
