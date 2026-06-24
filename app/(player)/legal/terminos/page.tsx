import Link from "next/link";

export default function TerminosPage() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-6">
      <Link href="/perfil" className="text-sm font-semibold text-[#0585FC]">
        Volver
      </Link>

      <header className="mb-6 mt-3 space-y-1">
        <p className="text-sm font-medium text-[#0585FC]">Legal</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Términos y Condiciones de Uso</h1>
        <p className="text-xs text-slate-400">Última actualización: Mayo 2026</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-slate-700">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">1. Aceptación de los Términos</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Al descargar, acceder y utilizar esta aplicación (en adelante, la "Plataforma"), el usuario (en
            adelante, el "Jugador" o "Usuario") acepta estar sujeto a los presentes Términos y Condiciones. Si no
            está de acuerdo con alguna parte de los términos, no podrá utilizar nuestros servicios. El uso continuado
            de la Plataforma implica la aceptación automática de cualquier modificación futura a estos términos, los
            cuales serán notificados con anticipación razonable.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">2. Naturaleza del Servicio</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            La Plataforma funciona exclusivamente como un servicio de intermediación tecnológica. Facilitamos la
            conexión entre Jugadores que desean reservar canchas de pádel y los Clubes o complejos deportivos (en
            adelante, los "Clubes") que ofrecen dichas instalaciones. La Plataforma no es propietaria, operadora ni
            administradora de las instalaciones deportivas, ni tiene control sobre la disponibilidad, calidad o
            condiciones de las mismas.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">3. Registro y Cuenta de Usuario</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Para acceder a las funcionalidades de la Plataforma, el Usuario debe registrarse proporcionando información
            veraz, completa y actualizada. El Usuario es responsable de mantener la confidencialidad de sus
            credenciales de acceso y de todas las actividades que ocurran bajo su cuenta. Padelibre se reserva el
            derecho de suspender o eliminar cuentas que violen estos términos.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">4. Reservas y Política de Pagos</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
            <li>
              Procesamiento: Los pagos realizados a través de la Plataforma son procesados por pasarelas de pago de
              terceros debidamente autorizadas en la República Argentina (Mercado Pago). Padelibre no almacena datos
              de tarjetas de crédito o débito.
            </li>
            <li>
              Comisión de servicio: El Jugador abona el precio base del turno más una comisión de servicio del 5%
              correspondiente al uso de la Plataforma. El 100% del precio base se transfiere automáticamente al Club a
              través de Mercado Pago. PadeLibre percibe únicamente la comisión del 5% como contraprestación por el
              servicio tecnológico.
            </li>
            <li>
              Confirmación: La reserva solo se considerará efectiva una vez que el pago haya sido procesado
              exitosamente y la Plataforma emita la confirmación en la sección "Mis Reservas".
            </li>
            <li>
              Precio por jugador: Cada Jugador abona únicamente su parte proporcional del turno (1/4 del valor total),
              más la comisión de servicio correspondiente.
            </li>
          </ul>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">5. Política de Cancelaciones y Reembolsos</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
            <li>Las cancelaciones deben realizarse con una antelación mínima de 60 minutos antes del inicio del turno.</li>
            <li>
              Si la cancelación se realiza dentro del plazo permitido, el reembolso se procesará automáticamente al
              medio de pago original dentro de los plazos establecidos por Mercado Pago.
            </li>
            <li>Si la cancelación se realiza fuera del plazo, no corresponderá reembolso alguno.</li>
            <li>
              Si el Club cancela la reserva por fuerza mayor, el Jugador tendrá derecho a la reprogramación del turno
              o a la devolución total del dinero abonado.
            </li>
            <li>
              Los costos financieros de la pasarela de pago asociados al reembolso podrán ser descontados del monto a
              devolver.
            </li>
          </ul>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">6. Deslinde y Limitación de Responsabilidad</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Estado de las Instalaciones: La Plataforma no garantiza ni se hace responsable por el estado físico de las
            canchas, la iluminación, los vestuarios ni la seguridad general dentro del predio del Club.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            Lesiones Físicas y Daños: El pádel es un deporte que conlleva riesgos físicos inherentes. La Plataforma no
            será responsable por ninguna lesión, accidente, daño a la salud, robo o hurto de pertenencias que sufra el
            Jugador dentro de las instalaciones del Club. Cualquier reclamo por estos motivos deberá dirigirse
            exclusivamente al Club, el cual es responsable de contar con los seguros de responsabilidad civil
            pertinentes.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            Fallas Técnicas: No garantizamos que la Plataforma esté libre de errores o interrupciones. No asumimos
            responsabilidad por caídas del sistema de pagos de terceros ni por pérdidas derivadas de las mismas.
          </p>
          <p className="text-sm leading-relaxed text-slate-600">
            Responsabilidad del Club: Los Clubes adheridos a la Plataforma son responsables exclusivos de mantener sus
            instalaciones en condiciones aptas para la práctica deportiva, de contar con los seguros de responsabilidad
            civil exigidos por la normativa vigente, y de cumplir con todas las obligaciones legales aplicables a su
            actividad. PadeLibre no garantiza ni avala las condiciones de ningún Club en particular.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">7. Sistema de Niveles y Conducta del Usuario</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            El Usuario se compromete a utilizar la Plataforma de buena fe. El sistema de niveles está diseñado para
            garantizar partidos equilibrados y una experiencia deportiva justa. La Plataforma se reserva el derecho de
            suspender o eliminar cuentas de Usuarios que: realicen reservas fraudulentas; tengan comportamientos
            agresivos o antideportivos reportados por otros Jugadores o Clubes; manipulen intencionalmente el sistema
            de niveles o estadísticas de juego; utilicen la Plataforma para actividades contrarias a las leyes
            vigentes.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">8. Propiedad Intelectual</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Todos los contenidos, marcas, logotipos, diseños y código fuente de la Plataforma son propiedad exclusiva
            de Padelibre o sus licenciantes. Queda expresamente prohibida su reproducción, distribución o uso sin
            autorización escrita previa.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">9. Modificaciones del Servicio</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Padelibre se reserva el derecho de modificar, suspender o discontinuar cualquier aspecto de la Plataforma
            en cualquier momento, con o sin previo aviso. No seremos responsables ante el Usuario ni terceros por dichas
            modificaciones.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">10. Jurisdicción y Ley Aplicable</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Estos Términos y Condiciones se rigen por las leyes de la República Argentina. Para cualquier controversia
            legal, las partes se someten a la jurisdicción de los Tribunales Ordinarios de la ciudad de Rosario,
            Provincia de Santa Fe, renunciando a cualquier otro fuero que pudiera corresponder.
          </p>
        </section>

        <hr className="border-slate-100" />

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">11. Turnos Fijos</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Los Usuarios pueden ser asignados a turnos fijos semanales por parte de los Clubes. Los turnos fijos generan
            reservas automáticas cada semana con estado &apos;pendiente de confirmación&apos;. El Usuario debe confirmar
            y abonar su lugar con al menos 24 horas de anticipación. La cancelación de un día puntual debe realizarse
            con no menos de 24 horas de antelación al inicio del turno. PadeLibre no se hace responsable por turnos
            fijos no confirmados ni por cancelaciones realizadas fuera de plazo.
          </p>
        </section>
      </div>
    </div>
  );
}
