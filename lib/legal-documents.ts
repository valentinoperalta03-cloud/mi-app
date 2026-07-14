export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  subsections?: { title: string; text: string }[];
};

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
