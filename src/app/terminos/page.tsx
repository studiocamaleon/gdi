import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "Términos de servicio | Grafoprint", description: "Condiciones aplicables al uso de Grafoprint." };

const sections: LegalSection[] = [
  { id: "alcance", title: "1. Alcance y aceptación", content: <>
    <p>Estos Términos regulan el acceso y uso de Grafoprint, una plataforma de gestión para empresas de la industria gráfica (el <strong>“Servicio”</strong>), ofrecida por <strong>GRUPO IDEA SAS</strong>, bajo la marca Grafoprint (en adelante, <strong>“Grafoprint”</strong>).</p>
    <p>Al crear una cuenta, aceptar una propuesta u orden de servicio, iniciar un período de prueba o utilizar el Servicio, la persona contratante declara haber leído y aceptado estos Términos y la Política de Privacidad. Si actúa por una empresa, declara contar con facultades suficientes para obligarla.</p>
    <p>Las condiciones particulares de una propuesta, orden de servicio o acuerdo firmado prevalecen sobre estos Términos únicamente respecto de aquello que regulen expresamente.</p>
  </> },
  { id: "servicio", title: "2. El Servicio", content: <>
    <p>Grafoprint brinda herramientas para organizar procesos comerciales, productivos, administrativos y de inventario. Según el plan contratado, puede incluir cotización, órdenes de trabajo, producción, archivos, clientes, cobranzas, reportes, facturación e integraciones.</p>
    <p>Grafoprint es una herramienta de apoyo. El Cliente conserva el control y la responsabilidad sobre precios, costos, márgenes, impuestos, diseños, instrucciones de producción, decisiones comerciales y resultados obtenidos a partir de la información ingresada.</p>
    <p>Las funciones, límites y niveles de soporte de cada plan son los informados en la propuesta o pantalla de contratación vigente. Las funciones identificadas como beta, experimentales o de prueba pueden cambiar o discontinuarse.</p>
  </> },
  { id: "cuentas", title: "3. Cuentas y usuarios", content: <>
    <ul><li>La información de registro debe ser verdadera, actual y completa.</li><li>Cada credencial es personal. El Cliente debe proteger contraseñas, accesos, dispositivos y permisos internos.</li><li>El administrador del tenant controla altas, bajas, roles y acceso de sus usuarios.</li><li>Las acciones realizadas desde una cuenta se presumen efectuadas por su titular o por una persona autorizada, sin perjuicio de prueba en contrario.</li><li>Los incidentes o accesos sospechosos deben informarse inmediatamente a Grafoprint.</li></ul>
    <p>El Cliente responde por el uso del Servicio realizado por sus usuarios, empleados, contratistas y terceros a quienes habilite.</p>
  </> },
  { id: "trial", title: "4. Período de prueba", content: <>
    <p>El Trial dura el plazo informado al registrarse y comienza al verificarse el correo y activarse el tenant. No requiere tarjeta salvo que se indique expresamente lo contrario antes del alta.</p>
    <p>El Trial es para evaluación, no es acumulable y puede limitarse a una cuenta por empresa, persona, dominio o grupo económico. Al finalizar, el acceso puede restringirse hasta contratar un plan. El Cliente podrá solicitar una exportación razonable de sus datos dentro del plazo de conservación informado.</p>
  </> },
  { id: "suscripcion", title: "5. Suscripción, precios e impuestos", content: <>
    <p>Los planes pagos se cobran por adelantado con la periodicidad elegida y se renuevan automáticamente hasta su cancelación, cuando así se informe en la contratación. Los importes se expresan en la moneda indicada y pueden no incluir impuestos, percepciones o cargos bancarios.</p>
    <p>Grafoprint podrá modificar precios para períodos futuros, informándolo con antelación razonable. El nuevo precio regirá desde la siguiente renovación; si el Cliente no lo acepta, podrá cancelar antes de esa fecha.</p>
    <p>Los pagos pueden ser procesados por proveedores externos. El Cliente autoriza el cobro del plan y es responsable de mantener un medio de pago válido. La falta de pago puede generar reintentos, limitación o suspensión del Servicio, previa notificación cuando sea razonablemente posible.</p>
  </> },
  { id: "cancelacion", title: "6. Cancelación y baja", content: <>
    <p>El Cliente puede cancelar la renovación desde las herramientas habilitadas o solicitándolo por escrito a soporte@grafoprint.com.ar. La baja será efectiva al finalizar el período ya abonado, salvo que la ley aplicable disponga otra cosa. No se reintegran períodos parcialmente utilizados, excepto cuando corresponda legalmente o se acuerde expresamente.</p>
    <p>Cuando resulte aplicable una relación de consumo, se respetarán el derecho de revocación, los procedimientos de baja y las demás normas imperativas de defensa del consumidor. Nada de estos Términos limita derechos irrenunciables.</p>
  </> },
  { id: "uso", title: "7. Uso permitido y prohibiciones", content: <>
    <p>El Cliente utilizará el Servicio de forma lícita, profesional y conforme a su finalidad. No podrá:</p>
    <ul><li>vulnerar derechos de terceros, normas laborales, fiscales, de propiedad intelectual, privacidad o protección de datos;</li><li>cargar malware, credenciales ajenas, contenido ilícito o datos obtenidos sin base legal;</li><li>intentar eludir límites, controles de acceso, aislamiento entre tenants o medidas de seguridad;</li><li>realizar ingeniería inversa, copiar o explotar el Servicio salvo en la medida permitida por normas inderogables;</li><li>revender, sublicenciar o prestar el Servicio a terceros fuera de su organización sin autorización;</li><li>usar automatizaciones de manera abusiva, saturar la infraestructura o afectar a otros usuarios.</li></ul>
  </> },
  { id: "datos", title: "8. Datos y contenido del Cliente", content: <>
    <p>El Cliente conserva la titularidad de la información, archivos, diseños, datos de clientes, empleados, proveedores y demás contenido que incorpore. Otorga a Grafoprint una licencia limitada, no exclusiva y temporal para alojar, copiar, procesar y transmitir ese contenido únicamente para prestar, asegurar, mantener y mejorar el Servicio.</p>
    <p>El Cliente declara contar con los derechos, autorizaciones y bases legales necesarios para tratar y cargar dicha información. Cuando Grafoprint procese datos personales por cuenta del Cliente, el Cliente actúa como responsable y Grafoprint como encargado o prestador de tratamiento, según corresponda.</p>
  </> },
  { id: "integraciones", title: "9. Integraciones y servicios de terceros", content: <>
    <p>El Servicio puede conectarse con ARCA/AFIP, proveedores de facturación, cobros, correo, mensajería, almacenamiento y otras plataformas. Su disponibilidad, reglas, precios y funcionamiento dependen de terceros.</p>
    <p>El Cliente es responsable de configurar correctamente sus cuentas, delegaciones, certificados, credenciales y permisos; de verificar comprobantes y operaciones antes de confirmarlos; y de cumplir las condiciones del tercero. Grafoprint no controla ni garantiza servicios externos, aunque adoptará medidas razonables para mantener las integraciones soportadas.</p>
  </> },
  { id: "fiscal", title: "10. Información fiscal y productiva", content: <>
    <p>Los cálculos de costos, márgenes, tiempos, impuestos, consumos, nesting y recorridos se basan en datos y configuraciones provistos por el Cliente. Deben ser revisados antes de cotizar, producir, facturar o ejecutar maquinaria.</p>
    <p>Grafoprint no presta asesoramiento contable, fiscal, legal, laboral ni de ingeniería. La emisión electrónica puede facilitarse mediante integraciones, pero el Cliente continúa siendo responsable por sus obligaciones ante ARCA y demás autoridades.</p>
  </> },
  { id: "disponibilidad", title: "11. Disponibilidad, mantenimiento y soporte", content: <>
    <p>Grafoprint procura mantener el Servicio disponible y seguro, pero no garantiza funcionamiento ininterrumpido ni libre de errores. Puede realizar mantenimiento programado o urgente y aplicar cambios necesarios por seguridad, cumplimiento o evolución técnica.</p>
    <p>Los compromisos específicos de disponibilidad, respuesta, soporte o recuperación sólo serán exigibles si constan en un acuerdo de nivel de servicio o plan que los incluya expresamente.</p>
  </> },
  { id: "seguridad", title: "12. Seguridad y copias", content: <>
    <p>Grafoprint aplica medidas técnicas y organizativas razonables según el riesgo, incluyendo controles de acceso, aislamiento lógico, registro de eventos y protección de secretos. Ningún sistema es absolutamente invulnerable.</p>
    <p>El Cliente debe conservar copias de la información crítica que necesite por obligaciones legales u operativas y verificar las exportaciones. Grafoprint notificará incidentes que afecten significativamente datos del Cliente conforme a la normativa y al rol que corresponda.</p>
  </> },
  { id: "propiedad", title: "13. Propiedad intelectual", content: <>
    <p>Grafoprint y sus licenciantes conservan todos los derechos sobre el software, marca, interfaces, documentación, modelos de datos, diseños y mejoras. La suscripción concede únicamente un derecho limitado, revocable, no exclusivo e intransferible de uso durante su vigencia.</p>
    <p>Las sugerencias pueden utilizarse para mejorar el Servicio sin obligación de compensación, siempre que no se revele información confidencial ni se identifique al Cliente sin autorización.</p>
  </> },
  { id: "confidencialidad", title: "14. Confidencialidad", content: <>
    <p>Cada parte protegerá la información confidencial de la otra con un cuidado razonable y la utilizará sólo para ejecutar la relación. Puede revelarse a personal y proveedores que necesiten conocerla y estén sujetos a deberes de confidencialidad, o cuando una autoridad competente lo exija.</p>
  </> },
  { id: "responsabilidad", title: "15. Garantías y responsabilidad", content: <>
    <p>El Servicio se presta con diligencia profesional razonable. En la máxima medida permitida por la ley, Grafoprint no responde por decisiones comerciales o productivas del Cliente, datos incorrectos, uso no autorizado de credenciales, fallas de terceros, fuerza mayor ni daños que el Cliente pudo evitar mediante revisión o respaldo razonable.</p>
    <p>Salvo dolo, culpa grave, lesiones, violaciones de confidencialidad o datos personales imputables a Grafoprint, y sin afectar derechos irrenunciables, la responsabilidad total de Grafoprint derivada del Servicio no excederá lo efectivamente pagado por el Cliente durante los doce meses anteriores al hecho que originó el reclamo. No se excluyen responsabilidades que legalmente no puedan limitarse.</p>
  </> },
  { id: "suspension", title: "16. Suspensión y terminación", content: <>
    <p>Grafoprint podrá suspender total o parcialmente el acceso ante falta de pago, riesgo de seguridad, uso ilícito, incumplimiento material o requerimiento de autoridad. Cuando sea razonable, notificará y dará oportunidad de subsanar.</p>
    <p>Cualquiera de las partes puede terminar por incumplimiento material no subsanado. Al terminar cesa el derecho de uso; las cláusulas de pagos pendientes, propiedad, confidencialidad, responsabilidad y resolución de disputas permanecen vigentes.</p>
  </> },
  { id: "cambios", title: "17. Cambios en estos Términos", content: <>
    <p>Grafoprint puede actualizar estos Términos por cambios legales, técnicos o comerciales. Las modificaciones materiales se informarán por el Servicio o correo con antelación razonable y regirán hacia el futuro. Si afectan sustancialmente la contratación y el Cliente no las acepta, podrá cancelar antes de su entrada en vigencia.</p>
  </> },
  { id: "ley", title: "18. Ley aplicable y disposiciones finales", content: <>
    <p>Estos Términos se rigen por las leyes de la República Argentina. Para relaciones B2B, las partes procurarán resolver de buena fe cualquier controversia y, si no fuera posible, se someterán a los tribunales ordinarios competentes del domicilio de Grafoprint, salvo acuerdo particular distinto. Si existe una relación de consumo, será competente la jurisdicción que determine la normativa protectoria aplicable.</p>
    <p>La nulidad de una disposición no afecta las restantes. La falta de ejercicio de un derecho no implica renuncia. El Cliente no puede ceder el contrato sin consentimiento previo; Grafoprint podrá cederlo en una reorganización o transferencia del negocio, preservando los derechos del Cliente.</p>
  </> },
];

export default function TerminosPage() {
  return <LegalDocument eyebrow="Documento legal" title="Términos de servicio" intro="Estas condiciones explican cómo se contrata y utiliza Grafoprint, qué responsabilidades asume cada parte y qué ocurre con la cuenta, los datos y la suscripción." notice={<>Grafoprint está pensado principalmente para empresas y profesionales de la industria gráfica. Estos Términos no eliminan ni restringen derechos que la legislación aplicable considere irrenunciables.</>} sections={sections} />;
}
