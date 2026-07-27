import Link from "next/link";

export default function PrivacidadPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-6">
      <Link href="/perfil" className="text-sm font-semibold text-[#0085FC]">
        Volver
      </Link>

      <header className="mb-6 mt-3 space-y-1">
        <p className="text-sm font-medium text-[#0085FC]">Legal</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Política de Privacidad</h1>
        <p className="text-xs text-slate-400">Última actualización: Abril 2026</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-slate-700">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">1. Marco Legal</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Esta Política de Privacidad se rige por la Ley N° 25.326 de Protección de Datos Personales de la República
            Argentina y sus normas reglamentarias. Al utilizar la Plataforma, el Usuario presta su consentimiento
            libre, expreso e informado para el tratamiento de sus datos personales conforme a lo aquí establecido.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">2. Responsable del Tratamiento de Datos</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            El responsable del tratamiento de los datos personales es Padelibre, con domicilio de contacto en
            soporte.padelibre@gmail.com. Ante cualquier consulta relacionada con el tratamiento de sus datos, el
            Usuario puede dirigirse a dicha dirección.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">3. Datos que Recopilamos</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
            <li>Datos Identificatorios: Nombre, apellido, dirección de correo electrónico y número de teléfono.</li>
            <li>
              Datos Deportivos: Nivel de juego autodeclarado o calculado por el sistema, historial de partidos, clubes
              favoritos, resultados y estadísticas.
            </li>
            <li>
              Datos de Ubicación: Ciudad y provincia del Usuario, obtenidos con su consentimiento expreso a través del
              GPS del dispositivo.
            </li>
            <li>
              Datos de Navegación: Dirección IP, tipo de dispositivo, sistema operativo e interacciones dentro de la
              app.
            </li>
            <li>
              Aclaración importante: La Plataforma NO almacena datos sensibles de tarjetas de crédito o débito. Estos
              son encriptados y gestionados íntegramente por Mercado Pago, proveedor del servicio de pago.
            </li>
          </ul>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">4. Finalidad del Tratamiento</h2>
          <p className="text-sm leading-relaxed text-slate-600">Los datos recolectados se utilizan exclusivamente para:</p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
            <li>
              Gestionar las reservas de canchas y comunicar los datos necesarios al Club correspondiente para el control
              de acceso.
            </li>
            <li>
              Notificar al Usuario sobre el estado de sus reservas, partidos abiertos, solicitudes de acceso y cambios
              de horario.
            </li>
            <li>
              Mejorar el sistema de emparejamiento (matchmaking) para ofrecer partidos acordes al nivel del Jugador.
            </li>
            <li>Mostrar sugerencias de jugadores y clubes cercanos según la ubicación del Usuario.</li>
            <li>Garantizar la seguridad de la plataforma y prevenir usos fraudulentos.</li>
          </ul>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">5. Almacenamiento y Seguridad</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            La base de datos de los Usuarios se encuentra alojada en servidores en la nube con altos estándares de
            seguridad y encriptación (infraestructura provista por Supabase, cumpliendo con estándares internacionales
            ISO 27001). Nos comprometemos a adoptar todas las medidas técnicas y organizativas necesarias para evitar la
            alteración, pérdida, tratamiento o acceso no autorizado a los datos personales.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">6. Confidencialidad y No Venta de Datos</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            La Plataforma asume el compromiso explícito de no vender, ceder ni comercializar la base de datos de sus
            Usuarios a terceras empresas para fines publicitarios externos a la aplicación. Compartiremos datos del
            Usuario únicamente en los siguientes casos: con el Club específico donde realizó una reserva (nombre y
            contacto, a fines organizativos); cuando sea requerido por autoridad judicial o administrativa competente;
            con proveedores de servicios técnicos estrictamente necesarios para el funcionamiento de la Plataforma (bajo
            acuerdos de confidencialidad).
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">7. Derechos ARCO del Usuario</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Conforme a la Ley 25.326, el Usuario tiene derecho a solicitar en cualquier momento: Acceso a sus datos
            personales; Rectificación de datos inexactos o incompletos; Cancelación (supresión) de sus datos; Oposición
            al tratamiento de sus datos. Para ejercer estos derechos, o solicitar la eliminación total de su cuenta y
            datos de nuestros servidores, el Usuario podrá: enviar un correo electrónico a
            soporte.padelibre@gmail.com, o utilizar la opción "Eliminar mi cuenta" disponible en Ajustes dentro de la
            app.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            La URL pública de esta política es: https://www.padelibre.online/privacidad
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">8. Cookies y Tecnologías de Seguimiento</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            La Plataforma puede utilizar tecnologías de seguimiento para mejorar la experiencia del usuario. Estas
            tecnologías no recopilan información personal identificable sin el consentimiento del Usuario. El Usuario
            puede configurar su dispositivo para rechazar estas tecnologías, aunque esto podría afectar el funcionamiento
            de algunas características de la app.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">9. Menores de Edad</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            La Plataforma no está dirigida a menores de 18 años. Si tomamos conocimiento de que hemos recopilado datos
            de un menor sin el consentimiento parental correspondiente, procederemos a eliminar dicha información de
            forma inmediata.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">10. Autoridad de Control</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Se informa al Usuario que la Agencia de Acceso a la Información Pública (AAIP), en su carácter de Órgano de
            Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan
            quienes resulten afectados en sus derechos por el incumplimiento de las normas vigentes en materia de
            protección de datos personales. Sitio web: www.argentina.gob.ar/aaip
          </p>
        </section>
      </div>
    </div>
  );
}
