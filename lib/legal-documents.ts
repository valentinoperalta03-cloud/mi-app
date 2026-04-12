export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  subsections?: { title: string; text: string }[];
};

export const legalTermsTitle = "Términos y Condiciones de Uso";

export const legalTermsSections: LegalSection[] = [
  {
    title: "1. Aceptación de los Términos",
    paragraphs: [
      'Al descargar, acceder y utilizar esta aplicación (en adelante, la "Plataforma"), el usuario (en adelante, el "Jugador" o "Usuario") acepta estar sujeto a los presentes Términos y Condiciones. Si no está de acuerdo con alguna parte de los términos, no podrá utilizar nuestros servicios.',
    ],
  },
  {
    title: "2. Naturaleza del Servicio",
    paragraphs: [
      'La Plataforma funciona exclusivamente como un servicio de intermediación tecnológica. Facilitamos la conexión entre Jugadores que desean reservar canchas de pádel y los Clubes o complejos deportivos (en adelante, los "Clubes") que ofrecen dichas instalaciones. La Plataforma no es propietaria, operadora ni administradora de las instalaciones deportivas.',
    ],
  },
  {
    title: "3. Reservas y Política de Pagos",
    paragraphs: [],
    bullets: [
      "Procesamiento: Los pagos realizados a través de la Plataforma son procesados por pasarelas de pago de terceros debidamente autorizadas en la República Argentina (ej. Mercado Pago).",
      "Distribución (Split Payment): Al abonar una reserva, el Jugador comprende que el monto total se divide automáticamente: una parte corresponde a la tarifa del Club por el uso de la instalación, y otra parte corresponde a la comisión por el servicio de uso de la Plataforma.",
      'Confirmación: La reserva solo se considerará efectiva una vez que el pago haya sido procesado exitosamente y la Plataforma emita la confirmación en la sección "Mis Reservas".',
    ],
  },
  {
    title: "4. Política de Cancelaciones y Reembolsos",
    paragraphs: [],
    bullets: [
      "Las cancelaciones deben realizarse con una antelación mínima estipulada por cada Club (visible al momento de la reserva).",
      "Si la cancelación se realiza dentro del plazo permitido, el reembolso se gestionará según los métodos disponibles (devolución al medio de pago original o crédito en la Plataforma), descontando los costos financieros de la pasarela de pago si los hubiere.",
      "Si el Club cancela la reserva por fuerza mayor (ej. condiciones climáticas en canchas descubiertas), el Jugador tendrá derecho a la reprogramación del turno o a la devolución total del dinero.",
    ],
  },
  {
    title: "5. Deslinde y Limitación de Responsabilidad (cláusula crítica)",
    paragraphs: [],
    subsections: [
      {
        title: "Estado de las Instalaciones",
        text: "La Plataforma no garantiza ni se hace responsable por el estado físico de las canchas, la iluminación, los vestuarios ni la seguridad general dentro del predio del Club.",
      },
      {
        title: "Lesiones Físicas y Daños",
        text: "El pádel es un deporte que conlleva riesgos físicos inherentes. La Plataforma no será responsable por ninguna lesión, accidente, daño a la salud, robo o hurto de pertenencias que sufra el Jugador dentro de las instalaciones del Club. Cualquier reclamo por estos motivos deberá dirigirse exclusivamente al Club, el cual es responsable de contar con los seguros de responsabilidad civil pertinentes.",
      },
      {
        title: "Fallas Técnicas",
        text: "No garantizamos que la Plataforma esté libre de errores o interrupciones, no asumiendo responsabilidad por caídas del sistema de pagos de terceros.",
      },
    ],
  },
  {
    title: "6. Conducta del Usuario y Sistema de Niveles",
    paragraphs: [
      "El Usuario se compromete a utilizar la Plataforma de buena fe. La Plataforma se reserva el derecho de suspender o eliminar cuentas de Usuarios que:",
    ],
    bullets: [
      "Realicen reservas fraudulentas.",
      "Tengan comportamientos agresivos o antideportivos reportados por otros jugadores o Clubes.",
      'Manipulen intencionalmente el sistema de "Niveles" o estadísticas de juego.',
    ],
  },
  {
    title: "7. Jurisdicción y Ley Aplicable",
    paragraphs: [
      "Estos Términos y Condiciones se rigen por las leyes de la República Argentina. Para cualquier controversia legal, las partes se someten a la jurisdicción de los Tribunales Ordinarios de la ciudad de Rosario, Provincia de Santa Fe, renunciando a cualquier otro fuero que pudiera corresponder.",
    ],
  },
];

export const legalPrivacyTitle = "Política de Privacidad";

export function getLegalContactEmail(): string {
  const v = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  return v && v.length > 0 ? v : "privacidad@tu-dominio.com";
}

export const legalPrivacySections: LegalSection[] = (() => {
  const legalEmail = getLegalContactEmail();
  return [
    {
      title: "1. Marco Legal",
      paragraphs: [
        "Esta Política de Privacidad se rige por la Ley N° 25.326 de Protección de Datos Personales de la República Argentina y sus normas reglamentarias.",
      ],
    },
    {
      title: "2. Datos que Recopilamos",
      paragraphs: [
        "Para el correcto funcionamiento del servicio (creación de perfil, reservas y búsqueda de partidos), recopilamos los siguientes datos:",
      ],
      bullets: [
        "Datos Identificatorios: Nombre, apellido, dirección de correo electrónico, y número de teléfono.",
        "Datos Deportivos: Nivel de juego autodeclarado o calculado por el sistema, historial de partidos, clubes favoritos y resultados.",
        "Datos de Navegación: Dirección IP, tipo de dispositivo e interacciones dentro de la app.",
        "Aclaración: La Plataforma NO almacena datos sensibles de tarjetas de crédito o débito. Estos son encriptados y gestionados íntegramente por el proveedor del servicio de pago.",
      ],
    },
    {
      title: "3. Uso de la Información",
      paragraphs: [
        "Los datos recolectados se utilizan exclusivamente para:",
      ],
      bullets: [
        "Gestionar las reservas de canchas y comunicar dichos datos al Club correspondiente para el control de acceso.",
        "Notificar al usuario sobre el estado de sus reservas, partidos abiertos o cambios de horario.",
        "Mejorar el sistema de emparejamiento (matchmaking) para ofrecer partidos acordes al nivel del Jugador.",
      ],
    },
    {
      title: "4. Almacenamiento y Seguridad de los Datos",
      paragraphs: [
        "La base de datos de los usuarios se encuentra alojada en servidores en la nube de alta seguridad y encriptación (infraestructura backend provista por terceros, cumpliendo con estándares internacionales). Nos comprometemos a adoptar todas las medidas técnicas necesarias para evitar la alteración, pérdida o acceso no autorizado a los datos.",
      ],
    },
    {
      title: "5. Confidencialidad (No Venta de Datos)",
      paragraphs: [
        "La Plataforma asume el compromiso de no vender, ceder ni comercializar la base de datos de sus Usuarios a terceras empresas para fines publicitarios externos a la aplicación. Solo compartiremos el nombre y teléfono del Jugador con el Club específico donde realizó una reserva, a fines organizativos.",
      ],
    },
    {
      title: "6. Derechos ARCO del Usuario",
      paragraphs: [
        `Conforme a la Ley 25.326, el Usuario tiene derecho a solicitar el Acceso, Rectificación, Cancelación u Oposición sobre sus datos personales. Para ejercer estos derechos, o solicitar la eliminación total de su cuenta y sus datos de nuestros servidores, el Usuario podrá enviar un correo electrónico a ${legalEmail}.`,
      ],
    },
    {
      title: "7. Agencia de Acceso a la Información Pública",
      paragraphs: [
        "Se informa al Usuario que la Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por el incumplimiento de las normas vigentes en materia de protección de datos personales.",
      ],
    },
  ];
})();
