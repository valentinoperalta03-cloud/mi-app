import { NextResponse } from "next/server";

const SUPPORT_EMAIL = "soporte.padelibre@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/5493412571953";

const CONTACT_MESSAGE = `No tengo información suficiente para responder eso. 
Podés contactarnos por:\n\n📧 **Email:** ${SUPPORT_EMAIL}\n💬 **WhatsApp:** ${SUPPORT_WHATSAPP}`;

type QA = { keywords: string[]; answer: string };

const QA_LIST: QA[] = [
  {
    keywords: ["reservar", "reserva", "cancha", "turno", "horario", "hora"],
    answer: `Para reservar una cancha:\n1. Andá a la sección **Reservar** desde el inicio\n2. Elegí un club cercano\n3. Seleccioná la cancha, fecha y horario disponible\n4. Confirmá y pagá tu parte (1/4 del turno)\n\nCada turno dura 90 minutos. El turno queda confirmado cuando los 4 jugadores paguen su parte.`,
  },
  {
    keywords: ["precio", "costo", "cuánto", "cuanto", "pagar", "pago", "plata", "valor"],
    answer: `El precio de cada turno lo define el club. Al reservar pagás únicamente tu parte (1/4 del total del turno) más una pequeña comisión de servicio de Padelibre.\n\nPor ejemplo: si el turno vale $12.000, cada jugador paga $3.000 + comisión.`,
  },
  {
    keywords: ["cancelar", "cancelación", "cancelacion", "devolver", "reembolso", "reembolsar"],
    answer: `Podés cancelar tu reserva desde la sección **Mis Reservas**.\n\n✅ Si cancelás con más de 1 hora de anticipación → recibís el reembolso completo.\n❌ Si cancelás con menos de 1 hora → no hay reembolso.\n\nEl reembolso se procesa automáticamente por Mercado Pago.`,
  },
  {
    keywords: ["partido", "crear partido", "amistoso", "competitivo", "unirse", "unirme"],
    answer: `Para crear un partido:\n1. Tocá **Crear Partido** en el inicio\n2. Elegí club, cancha, fecha y horario\n3. Seleccioná si es amistoso o competitivo\n4. Definí la categoría y visibilidad\n5. Confirmá y pagá tu parte\n\nCada jugador paga su parte al unirse. El partido aparece en **Buscar Partido** para que otros se sumen.`,
  },
  {
    keywords: [
      "nivel",
      "niveles",
      "categoría",
      "categoria",
      "nivelación",
      "nivelacion",
      "8va",
      "7ma",
      "6ta",
      "5ta",
      "4ta",
      "3ra",
      "2da",
      "1ra",
    ],
    answer: `Los niveles en Padelibre son:\n\n🎾 **8va** - Principiante\n🎾 **7ma** - Básico\n🎾 **6ta** - Intermedio bajo\n🎾 **5ta** - Intermedio\n🎾 **4ta** - Intermedio alto\n🎾 **3ra** - Avanzado\n🎾 **2da/1ra** - Elite\n\nTu nivel se determina al completar la nivelación inicial y evoluciona según tus resultados en partidos competitivos.`,
  },
  {
    keywords: ["mercado pago", "mercadopago", "pagar", "método de pago", "metodo de pago", "tarjeta"],
    answer: `Los pagos en Padelibre se procesan de forma segura a través de **Mercado Pago**.\n\nAceptamos:\n💳 Tarjeta de crédito y débito\n💰 Dinero en cuenta de Mercado Pago\n🏪 Efectivo (Rapipago / Pago Fácil)\n\nTus datos de pago están protegidos por Mercado Pago.`,
  },
  {
    keywords: ["club", "clubes", "lugar", "lugares", "cerca", "cancha"],
    answer: `Para ver los clubes disponibles:\n1. Andá a la sección **Reservar** desde el inicio\n2. Verás todos los clubes disponibles cerca tuyo\n3. Cada club muestra sus canchas con precios y horarios disponibles\n\nSi tu club favorito no está en la app, podés sugerirlo contactándonos.`,
  },
  {
    keywords: ["horarios", "disponibilidad", "días", "dias", "abierto"],
    answer: `Los horarios dependen de cada club. En general los turnos disponibles son:\n\n⏰ 09:00 a 00:00hs\nCada turno dura 90 minutos.\n\nPodés ver la disponibilidad real de cada cancha al momento de hacer la reserva.`,
  },
  {
    keywords: ["privado", "público", "publico", "visibilidad", "partido privado"],
    answer: `Al crear un partido podés elegir:\n\n🔓 **Público** - Aparece en Buscar Partido para que cualquier jugador se sume\n🔒 **Privado** - Solo lo ven tus amigos en la app. Podés invitar jugadores con un link único o aceptar solicitudes manualmente.`,
  },
  {
    keywords: ["reglas", "reglamento", "cómo se juega", "como se juega", "puntos", "sets", "juego"],
    answer: `El pádel se juega en parejas (2 vs 2) en una cancha cerrada con paredes.\n\n📋 **Reglas básicas:**\n- Se juega al mejor de 3 sets\n- Cada set se gana llegando a 6 juegos\n- En empate 6-6 hay tie-break\n- Se puede usar la pared después del bote\n- El saque es diagonal y debe picar antes de la pared\n\nEl objetivo es que la pelota no pueda ser devuelta por el rival.`,
  },
  {
    keywords: ["técnica", "tecnica", "golpes", "volea", "bandeja", "remate", "smash", "globo", "bajada"],
    answer: `Los principales golpes del pádel son:\n\n🎾 **Derecha/Revés** - Golpes de fondo de cancha\n🎾 **Volea** - Golpe en el aire sin dejar picar\n🎾 **Bandeja** - Golpe de ataque por arriba\n🎾 **Remate/Smash** - Golpe fuerte hacia abajo\n🎾 **Globo** - Golpe alto para recuperar posición\n🎾 **Bajada de pared** - Aprovechando el rebote en la pared\n\nLa posición en la red es fundamental para dominar el partido.`,
  },
  {
    keywords: ["contraseña", "password", "cuenta", "email", "correo", "login", "ingresar", "acceder"],
    answer: `Si tenés problemas para acceder a tu cuenta:\n\n1. En la pantalla de login tocá **¿Olvidaste tu contraseña?**\n2. Ingresá tu email y te enviamos un link de recuperación\n3. También podés cambiar tu contraseña desde **Ajustes → Seguridad**\n\nSi seguís sin poder ingresar, contactanos.`,
  },
  {
    keywords: ["perfil", "foto", "avatar", "nombre", "editar", "modificar"],
    answer: `Para editar tu perfil:\n1. Andá a la sección **Perfil** (abajo a la derecha)\n2. Tocá **Editar perfil**\n3. Podés cambiar: foto, nombre, edad, bio y género\n\nTambién podés acceder desde el menú (☰) → **Editar perfil**.`,
  },
  {
    keywords: ["notificación", "notificaciones", "notificacion", "avisos"],
    answer: `Podés gestionar tus notificaciones desde:\n**Menú (☰) → Ajustes → Notificaciones**\n\nActivá o desactivá los avisos de nuevos partidos, reservas y solicitudes.`,
  },
  {
    keywords: ["eliminar", "borrar", "darme de baja", "baja"],
    answer: `Para eliminar tu cuenta:\n**Menú (☰) → Ajustes → Cuenta → Eliminar mi cuenta**\n\n⚠️ Esta acción es irreversible y elimina todos tus datos.\n\nSi tenés reservas activas, cancelalas primero para recibir el reembolso.`,
  },
  {
    keywords: ["posición", "posicion", "donde pararme", "red", "fondo", "táctica", "tactica"],
    answer: `La táctica básica del pádel:\n\n📍 **Posición en la red** - Es la posición dominante. Desde ahí controlás el punto con voleas y bandejas.\n📍 **Fondo de cancha** - Posición defensiva. El objetivo es subir a la red lo antes posible.\n\n💡 **Consejo clave:** Los dos jugadores de la pareja siempre deben moverse juntos, manteniendo la misma línea horizontal.`,
  },
  {
    keywords: ["pared", "paredes", "rebote", "cristal", "vidrio", "malla", "alambre"],
    answer: `Las paredes son parte fundamental del pádel:\n\n🔵 **Paredes de cristal** - En los fondos y laterales. La pelota puede usarse después del bote.\n🔵 **Malla metálica** - En la parte superior de los laterales. También es válido usarla.\n\n⚠️ La pelota puede tocar la pared del rival SOLO después de haber picado en el suelo de su lado.`,
  },
  {
    keywords: ["saque", "servicio", "sacar", "primer saque", "segundo saque"],
    answer: `Reglas del saque en pádel:\n\n✅ Se saca desde abajo de la cintura\n✅ La pelota debe picar en el cuadro diagonal\n✅ Hay dos intentos (primer y segundo saque)\n✅ El pie no puede pasar la línea de saque\n✅ Después del bote puede tocar la pared lateral o de fondo\n\n❌ Si toca la malla es falta. Si toca la línea del T es válido (sin let).`,
  },
  {
    keywords: ["doble bote", "doble pique", "ganar punto", "punto", "falta"],
    answer: `Se gana un punto cuando:\n\n✅ La pelota bota dos veces en el campo rival\n✅ El rival la manda a la red\n✅ El rival la saca fuera\n✅ La pelota toca el cuerpo del rival antes de botar\n✅ El rival toca la red\n\n💡 A diferencia del tenis, en pádel la pelota puede salir por la puerta y seguir en juego si vuelve al campo.`,
  },
  {
    keywords: ["equipamiento", "equipo", "pala", "paleta", "pelota", "zapatillas", "ropa", "vestimenta"],
    answer: `Equipamiento básico para jugar pádel:\n\n🏓 **Pala** - Las hay de distintos materiales (carbono, fibra de vidrio, foam). Para principiantes se recomienda forma redonda o diamante bajo.\n⚪ **Pelota** - Específica de pádel, más blanda que la de tenis.\n👟 **Zapatillas** - Recomendadas las de pádel o tenis con suela de espiga para mayor agarre.\n👕 **Ropa** - Cómoda y transpirable. No hay reglamentación específica.`,
  },
  {
    keywords: ["lesión", "lesion", "lesiones", "calentamiento", "stretching", "entrada en calor"],
    answer: `Para evitar lesiones en pádel:\n\n🔥 **Calentamiento previo (10 min):**\n- Trote suave\n- Rotación de hombros y muñecas\n- Estiramiento de piernas\n- Peloteo suave antes de empezar\n\n⚠️ Las lesiones más comunes son: codo (epicondilitis), rodilla y tobillo.\n\n💡 Usá zapatillas adecuadas y no juegues con dolor.`,
  },
  {
    keywords: ["torneo", "torneos", "competencia", "competencia", "ranking", "clasificación", "clasificacion"],
    answer: `La sección de **Torneos** en Padelibre está en desarrollo 🚧\n\nPróximamente podrás:\n🏆 Inscribirte en torneos locales\n📊 Ver tu ranking oficial\n🥇 Competir por categorías\n\nPor ahora podés crear partidos **competitivos** desde la sección Crear Partido para sumar puntos a tu nivel.`,
  },
  {
    keywords: ["amigo", "amigos", "favorito", "favoritos", "seguir", "agregar"],
    answer: `Podés agregar jugadores como favoritos desde su perfil.\n\nBeneficios de tener favoritos:\n👥 Ven tus partidos privados en Buscar Partido\n🔔 Podés invitarlos directamente a tus partidos\n📊 Aparecen en tu sección "Personas con las que más jugás"\n\nBuscalos en la sección **Comunidad**.`,
  },
  {
    keywords: ["comunidad", "feed", "publicación", "publicacion", "post", "mensaje", "mensajes", "chat"],
    answer: `En la sección **Comunidad** encontrás:\n\n📰 **Feed** - Publicaciones de la comunidad padelística\n🔍 **Buscar** - Encontrá jugadores por nombre o nivel\n💬 **Mensajes** - Chat directo con otros jugadores\n\nPodés publicar sobre tus partidos, compartir logros y conectar con jugadores de tu nivel.`,
  },
  {
    keywords: ["solicitud", "solicitudes", "acceso", "unirse", "votación", "votacion", "votar"],
    answer: `Cuando un partido tiene **restricción de nivel**, los jugadores fuera del rango pueden enviar una solicitud.\n\n📋 **Cómo funciona:**\n1. El jugador toca "Solicitar unirse"\n2. Los jugadores del partido reciben una notificación\n3. Votan por mayoría simple (más de la mitad)\n4. Si aprueban → el jugador se une automáticamente\n\nVés las solicitudes pendientes en tu **Inicio** y en la página del partido.`,
  },
  {
    keywords: ["notificación", "notificaciones", "aviso", "avisos", "alerta"],
    answer: `Padelibre te notifica sobre:\n\n🔔 Nuevas solicitudes para unirse a tus partidos\n🔔 Cuando alguien acepta o rechaza tu solicitud\n🔔 Recordatorio de tus reservas próximas\n🔔 Resultados de partidos pendientes de confirmar\n\nPodés gestionar las notificaciones desde **Menú (☰) → Ajustes → Notificaciones**.`,
  },
  {
    keywords: ["resultado", "resultados", "confirmar resultado", "marcador", "score", "ganador"],
    answer: `Después de un partido competitivo:\n\n1. Uno de los jugadores carga el resultado\n2. Los demás participantes reciben una notificación\n3. Deben confirmar o disputar el resultado\n4. Si hay mayoría → el resultado queda confirmado\n5. Los niveles se actualizan automáticamente según el resultado\n\nEsto asegura que nadie pueda cargar resultados falsos.`,
  },
  {
    keywords: ["clase", "clases", "profesor", "entrenamiento", "entrenar", "aprender"],
    answer: `La sección de **Clases** en Padelibre está en desarrollo 🚧\n\nPróximamente podrás:\n📚 Reservar clases con profesores certificados\n🎯 Clases grupales o individuales\n📹 Contenido de entrenamiento online\n\nPor ahora podés mejorar tu nivel jugando partidos competitivos y acumulando experiencia.`,
  },
  {
    keywords: ["ubicación", "ubicacion", "ciudad", "zona", "cerca", "gps", "localización", "localizacion"],
    answer: `Para configurar tu ubicación:\n**Menú (☰) → Ajustes → Mi cuenta → Detectar mi ubicación**\n\nTu ubicación nos ayuda a:\n📍 Mostrarte clubes cercanos\n👥 Sugerirte jugadores de tu zona\n🎾 Recomendarte partidos cerca tuyo\n\nNecesitás activar el GPS de tu dispositivo.`,
  },
  {
    keywords: ["gratis", "gratuito", "cobran", "cobra", "comisión", "comision", "fee"],
    answer: `Padelibre es **gratuito** para los jugadores.\n\nSolo pagás cuando hacés una reserva o te unís a un partido:\n💳 El precio del turno lo define el club\n💳 Pagás únicamente tu parte (1/4 del turno)\n💳 Se agrega una pequeña comisión de servicio\n\nNo hay suscripción ni cargos ocultos.`,
  },
  {
    keywords: ["hola", "buenas", "buen día", "buen dia", "buenas tardes", "buenas noches", "hey"],
    answer: `¡Hola! 👋 Soy el asistente de Padelibre.\n\n¿En qué puedo ayudarte hoy? Puedo responder preguntas sobre:\n🎾 Cómo usar la app\n📅 Reservas y partidos\n💳 Pagos y cancelaciones\n📊 Niveles y categorías\n🏓 Reglas y técnica del pádel`,
  },
  {
    keywords: ["gracias", "ok", "entendí", "entendi", "perfecto", "excelente", "genial"],
    answer: `¡De nada! 😊 Si tenés más dudas, estoy acá para ayudarte.\n\nRecordá que también podés contactarnos directamente:\n📧 soporte.padelibre@gmail.com\n💬 WhatsApp disponible para consultas más específicas.`,
  },
];

function getBotResponse(userMessage: string): string {
  const msg = userMessage
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const qa of QA_LIST) {
    if (
      qa.keywords.some((kw) =>
        msg.includes(
          kw
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
        )
      )
    ) {
      return qa.answer;
    }
  }

  return CONTACT_MESSAGE;
}

export async function POST(req: Request) {
  try {
    const { message } = (await req.json()) as { message: string };
    if (!message?.trim()) {
      return NextResponse.json({ content: "¿En qué puedo ayudarte?" });
    }
    const content = getBotResponse(message.trim());
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: CONTACT_MESSAGE });
  }
}
