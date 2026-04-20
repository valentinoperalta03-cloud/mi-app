import { NextResponse } from "next/server";

const SUPPORT_EMAIL = "soporte.padelibre@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/5493412571953";

const CONTACT = `¿Necesitás más ayuda? Contactanos:\n\n📧 ${SUPPORT_EMAIL}\n💬 ${SUPPORT_WHATSAPP}`;

export const QUESTIONS: { id: string; label: string; answer: string; category: string }[] = [
  // PAGOS
  {
    id: "como_pago",
    category: "Pagos",
    label: "¿Cómo se realiza el pago?",
    answer: `Los pagos se procesan de forma segura a través de **Mercado Pago**.\n\nCuando reservás una cancha o te unís a un partido, pagás únicamente tu parte (1/4 del turno total) más una pequeña comisión de servicio.\n\nAceptamos:\n💳 Tarjeta de crédito y débito\n💰 Dinero en cuenta de Mercado Pago\n🏪 Efectivo (Rapipago / Pago Fácil)`,
  },
  {
    id: "cuanto_pago",
    category: "Pagos",
    label: "¿Cuánto paga cada jugador?",
    answer: `Cada jugador paga **su parte proporcional** del turno:\n\n💰 Precio del turno ÷ 4 jugadores + comisión de servicio\n\nEjemplo: Si el turno vale $12.000\n→ Cada jugador paga $3.000 + comisión\n\nEl precio de cada cancha lo define el club.`,
  },
  {
    id: "cuando_cobran",
    category: "Pagos",
    label: "¿Cuándo se me cobra?",
    answer: `El cobro se realiza **inmediatamente** al confirmar la reserva o al unirte a un partido.\n\nEl turno queda confirmado cuando los 4 jugadores hayan pagado su parte.\n\nHasta que no estén los 4 pagos, el turno figura como "pendiente de confirmación".`,
  },
  // DEVOLUCIONES
  {
    id: "como_devolucion",
    category: "Devoluciones",
    label: "¿Cómo pido una devolución?",
    answer: `Para solicitar una devolución:\n\n1. Andá a **Mis Reservas**\n2. Tocá la reserva que querés cancelar\n3. Presioná **Cancelar reserva**\n4. Si cancelas con más de 60 minutos de anticipación → reembolso automático\n\nEl dinero vuelve al medio de pago original dentro de los plazos de Mercado Pago (1-10 días hábiles).`,
  },
  {
    id: "tiempo_devolucion",
    category: "Devoluciones",
    label: "¿Cuánto tarda el reembolso?",
    answer: `El reembolso se procesa **automáticamente** pero los tiempos dependen del medio de pago:\n\n💳 Tarjeta de crédito: 1-10 días hábiles\n💳 Tarjeta de débito: 1-5 días hábiles\n💰 Cuenta Mercado Pago: inmediato\n🏪 Efectivo: no aplica reembolso directo\n\nSi pasaron más de 10 días hábiles y no recibiste el reembolso, contactanos.`,
  },
  {
    id: "no_devolucion",
    category: "Devoluciones",
    label: "¿Cuándo NO hay devolución?",
    answer: `No hay devolución cuando:\n\n❌ Cancelás con **menos de 60 minutos** de anticipación al turno\n❌ No te presentás al turno sin cancelar previamente\n❌ El partido fue completado normalmente\n\n💡 Siempre cancelá con tiempo para asegurarte el reembolso.`,
  },
  // PARTIDOS
  {
    id: "crear_partido",
    category: "Partidos",
    label: "¿Cómo creo un partido?",
    answer: `Para crear un partido:\n\n1. Tocá **Crear Partido** en el inicio\n2. Elegí club, cancha, fecha y horario\n3. Seleccioná tipo: Amistoso o Competitivo\n4. Elegí visibilidad: Público o Privado\n5. Seleccioná categoría: Masculino, Femenino o Mixto\n6. Confirmá y pagá tu parte\n\nSi el partido es **público**, aparece en Buscar Partido para que otros jugadores se sumen.`,
  },
  {
    id: "unirse_partido",
    category: "Partidos",
    label: "¿Cómo me uno a un partido?",
    answer: `Para unirte a un partido:\n\n1. Andá a **Buscar Partido**\n2. Encontrá un partido disponible\n3. Tocá **Unirse**\n4. Pagá tu parte del turno\n5. ¡Listo! Quedás confirmado\n\n⚠️ Si el partido tiene restricción de nivel, necesitás estar dentro del rango del creador (±1 nivel). Si no, podés enviar una solicitud que los jugadores votarán.`,
  },
  {
    id: "partido_privado",
    category: "Partidos",
    label: "¿Cómo funciona un partido privado?",
    answer: `Un partido privado:\n\n🔒 Solo lo ven tus amigos en la app\n🔗 Podés compartir un **link de invitación** para que otros accedan\n✅ El creador acepta o rechaza manualmente las solicitudes de acceso\n\nPara invitar: andá a la página del partido → "Copiar link de invitación" y compartilo con quien quieras.`,
  },
  {
    id: "cancelar_partido",
    category: "Partidos",
    label: "¿Qué pasa si cancelo un partido?",
    answer: `Si cancelás tu participación en un partido:\n\n✅ Con más de 60 min de anticipación → reembolso automático\n❌ Con menos de 60 min → sin reembolso\n\nSi sos el **creador** del partido y lo cancelás:\n- Todos los jugadores reciben el reembolso automáticamente\n- El turno queda liberado en la cancha`,
  },
  // INCONVENIENTES
  {
    id: "no_puedo_ingresar",
    category: "Inconvenientes",
    label: "No puedo ingresar a mi cuenta",
    answer: `Si no podés ingresar:\n\n1. Verificá que el email y contraseña sean correctos\n2. Intentá con **"¿Olvidaste tu contraseña?"** en el login\n3. Revisá tu casilla de email (incluyendo spam)\n4. Si usás Google para ingresar, asegurate de estar logueado en Google\n\nSi el problema persiste, contactanos con tu email registrado.`,
  },
  {
    id: "pago_fallido",
    category: "Inconvenientes",
    label: "Mi pago fue rechazado",
    answer: `Si tu pago fue rechazado:\n\n1. Verificá que tu tarjeta tenga fondos suficientes\n2. Verificá que los datos de la tarjeta sean correctos\n3. Intentá con otro medio de pago\n4. Verificá con tu banco si hay restricciones para pagos online\n5. Intentá con dinero en tu cuenta de Mercado Pago\n\nSi el problema persiste, contactanos.`,
  },
  {
    id: "reserva_no_aparece",
    category: "Inconvenientes",
    label: "Mi reserva no aparece confirmada",
    answer: `Si tu reserva no aparece:\n\n1. Verificá en **Mis Reservas** que el estado sea "Confirmada"\n2. Revisá si el pago fue aprobado en **Mis Pagos**\n3. Si el pago fue aprobado pero la reserva no aparece, esperá unos minutos y recargá\n4. Si pagaste pero dice "Pendiente", significa que falta que los demás jugadores paguen su parte\n\nSi el pago fue descontado y no aparece la reserva, contactanos urgente.`,
  },
  {
    id: "jugador_no_viene",
    category: "Inconvenientes",
    label: "Un jugador no se presentó al turno",
    answer: `Si un jugador no se presenta:\n\n😤 Lamentablemente cada jugador es responsable de su asistencia.\n\nLo que podés hacer:\n1. Reportar al jugador desde su perfil\n2. Jugadores con múltiples ausencias pueden ser suspendidos de la plataforma\n3. El dinero ya pagado no se reembolsa por ausencia de otros jugadores\n\n💡 Para evitar esto, te recomendamos coordinar por la sección de **Mensajes** antes del partido.`,
  },
  {
    id: "club_cancela",
    category: "Inconvenientes",
    label: "El club canceló mi reserva",
    answer: `Si el club cancela tu reserva:\n\n✅ Recibís el **reembolso total** automáticamente\n✅ El turno queda liberado para que puedas reservar otro horario\n\nSi no recibiste el reembolso dentro de los plazos correspondientes, contactanos con el número de reserva y te ayudamos a gestionarlo.`,
  },
  {
    id: "contacto",
    category: "Más ayuda",
    label: "Hablar con soporte humano",
    answer: `¿Necesitás hablar con una persona?\n\n📧 **Email:** soporte.padelibre@gmail.com\n💬 **WhatsApp:** +54 9 341 257-1953\n\nNuestro equipo responde en horario comercial (Lunes a Viernes 9-18hs).\n\nAl contactarnos, indicá tu email registrado y una descripción del problema.`,
  },
];

export async function POST(req: Request) {
  try {
    const { questionId } = (await req.json()) as { questionId: string };
    const qa = QUESTIONS.find((q) => q.id === questionId);
    if (!qa) {
      return NextResponse.json({ content: CONTACT });
    }
    return NextResponse.json({ content: qa.answer });
  } catch {
    return NextResponse.json({ content: CONTACT });
  }
}

export async function GET() {
  return NextResponse.json({ questions: QUESTIONS });
}
