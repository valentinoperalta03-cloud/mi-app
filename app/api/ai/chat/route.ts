import { NextResponse } from "next/server";

const SUPPORT_EMAIL = "soporte.padelibre@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/5493413741000";

const CONTACT = `¿Necesitás más ayuda? Contactanos:\n\n📧 ${SUPPORT_EMAIL}\n💬 ${SUPPORT_WHATSAPP}`;

export const QUESTIONS: { id: string; label: string; answer: string; category: string }[] = [
  // PAGOS
  {
    id: "como_pago",
    category: "Pagos",
    label: "¿Cómo se realiza el pago?",
    answer: `Los pagos se procesan de forma segura a través de **Mercado Pago**.\n\nSolo paga quien organiza el partido o hace la reserva. El club puede requerir una seña para confirmar la reserva — el monto lo define cada club. Unirte a un partido ya creado no tiene costo en la app.\n\nAceptamos:\n💳 Tarjeta de crédito y débito\n💰 Dinero en cuenta de Mercado Pago\n🏪 Efectivo (Rapipago / Pago Fácil)`,
  },
  {
    id: "cuanto_pago",
    category: "Pagos",
    label: "¿Cuánto se paga por un turno?",
    answer: `Lo paga quien organiza el partido o hace la reserva, no cada jugador por separado.\n\nEl club puede requerir una seña para confirmar la reserva. El monto lo define cada club — puede ser un porcentaje del turno o un monto fijo. El resto se abona directamente en el club.\n\nEl precio de cada cancha también lo define el club.`,
  },
  {
    id: "cuando_cobran",
    category: "Pagos",
    label: "¿Cuándo se cobra la reserva?",
    answer: `El cobro (si el club requiere seña) se realiza **inmediatamente** al confirmar la reserva o crear el partido.\n\nSi el club no requiere seña, la reserva queda confirmada al instante y el pago se coordina directamente con el club.`,
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
    answer: `Para crear un partido:\n\n1. Tocá **Crear Partido** en el inicio\n2. Elegí club, cancha, fecha y horario\n3. Seleccioná tipo: Amistoso o Competitivo\n4. Elegí visibilidad: Público o Privado\n5. Seleccioná categoría: Masculino, Femenino o Mixto\n6. Confirmá (y pagá la seña si el club la requiere)\n\nSi el partido es **público**, aparece en Buscar Partido para que otros jugadores se sumen gratis.`,
  },
  {
    id: "unirse_partido",
    category: "Partidos",
    label: "¿Cómo me uno a un partido?",
    answer: `Para unirte a un partido:\n\n1. Andá a **Buscar Partido**\n2. Encontrá un partido disponible\n3. Tocá **Unirse**\n4. ¡Listo! Quedás confirmado al instante, sin pagar nada en la app\n\nEl pago de la cancha lo coordinás directamente con el organizador o el club.\n\n⚠️ Si el partido tiene restricción de nivel, necesitás estar dentro del rango del creador (±1 nivel). Si no, podés enviar una solicitud que los jugadores votarán.`,
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
    answer: `Si sos el **organizador** y cancelás el partido o la reserva:\n\n✅ Con más de 60 min de anticipación → reembolso automático de la seña (si pagaste una)\n❌ Con menos de 60 min → sin reembolso\n\nEl turno queda liberado en la cancha apenas se cancela.\n\nSi solo salís del partido sin ser el organizador, no hay ningún pago que reembolsar — no pagaste nada al unirte.`,
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
    answer: `Si tu reserva no aparece:\n\n1. Verificá en **Mis Reservas** que el estado sea "Confirmada"\n2. Revisá si el pago de la seña fue aprobado en **Mis Pagos**\n3. Si el pago fue aprobado pero la reserva no aparece, esperá unos minutos y recargá\n\nSi el pago fue descontado y no aparece la reserva, contactanos urgente.`,
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
    answer: `¿Necesitás hablar con una persona?\n\n📧 **Email:** soporte.padelibre@gmail.com\n💬 **WhatsApp:** +54 9 341 374-1000\n\nNuestro equipo responde en horario comercial (Lunes a Viernes 9-18hs).\n\nAl contactarnos, indicá tu email registrado y una descripción del problema.`,
  },
  {
    id: "pago_efectivo_transferencia",
    category: "Pagos",
    label: "¿Puedo pagar en efectivo o transferencia?",
    answer: `Sí. Al crear un partido o hacer una reserva, si el club requiere seña podés elegir cómo pagarla:\n\n💳 **Mercado Pago** → Pagás online al instante\n🏦 **Transferencia** → Transferís antes de ir y guardás el comprobante para mostrarlo al ingresar\n💵 **Efectivo** → Abonás directamente en el club\n\nSi el club no tiene Mercado Pago configurado, solo verás las opciones offline disponibles. Unirte a un partido ya creado no requiere ningún pago.`,
  },
  {
    id: "confirmar_transferencia",
    category: "Pagos",
    label: "Pagué por transferencia, ¿cómo confirmo mi reserva?",
    answer: `Si organizaste el partido o hiciste la reserva eligiendo transferencia:\n\n1. Tu turno queda **reservado**\n2. En la pantalla de la reserva/partido aparece un botón para confirmar la transferencia al club\n3. Tocá ese botón → se abre WhatsApp con un mensaje pre-armado al club\n4. El club verifica la transferencia y confirma tu turno en su panel\n\n⚠️ Si no podés transferir antes, podés abonar en efectivo en el mostrador del club.`,
  },
  {
    id: "comision_servicio",
    category: "Pagos",
    label: "¿PadeLibre cobra comisión por cada reserva?",
    answer: `No. El club puede requerir una seña para confirmar la reserva. El monto lo define cada club.\n\nPadeLibre no cobra ninguna comisión por reserva ni por turno — el 100% de lo que se paga en la app va directo a la cuenta del club.`,
  },
  {
    id: "chat_grupo_partido",
    category: "Partidos",
    label: "¿Cómo funciona el chat del partido?",
    answer: `Cada partido tiene su propio **grupo de chat** donde pueden coordinar los 4 jugadores.\n\nEl grupo se crea automáticamente cuando se crea el partido.\n\nPodés acceder al chat desde:\n1. La pantalla del partido → botón "Chat del grupo"\n2. La sección Mensajes → pestaña Grupos\n\nTodos los jugadores que se unen al partido entran automáticamente al grupo.`,
  },
  {
    id: "onboarding_perfil",
    category: "Inconvenientes",
    label: "No me deja unirme ni crear partidos",
    answer: `Para poder crear o unirte a partidos necesitás **completar tu perfil**.\n\nQué necesitás:\n✅ Nombre\n✅ Género\n✅ Quiz de nivel (para tu ranking ELO)\n\nCómo completarlo:\n1. Andá al menú (☰) → Editar perfil\n2. O desde la pantalla del partido → el sistema te va a guiar automáticamente\n\nSolo toma 2 minutos y te habilita todas las funciones de la app.`,
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
