import type { Metadata } from "next";
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "Política de privacidad | Grafoprint", description: "Cómo Grafoprint recopila, utiliza y protege los datos personales." };

const sections: LegalSection[] = [
  { id: "responsable", title: "1. Responsable y alcance", content: <>
    <p><strong>GRUPO IDEA SAS</strong>, bajo la marca Grafoprint, es responsable del tratamiento de los datos personales utilizados para registrar cuentas, administrar suscripciones, prestar soporte, operar el sitio y mantener la relación comercial.</p>
    <p>Esta Política se aplica al sitio comercial, el registro, la aplicación Grafoprint y las comunicaciones relacionadas. No regula sitios o servicios de terceros enlazados, que tienen sus propias políticas.</p>
  </> },
  { id: "roles", title: "2. Nuestros roles sobre los datos", content: <>
    <h3>Datos de cuenta y relación comercial</h3><p>Grafoprint actúa como responsable respecto de los datos de administradores, usuarios, contactos comerciales, facturación, seguridad y uso de la plataforma.</p>
    <h3>Datos cargados por cada tenant</h3><p>Cada Cliente decide qué datos de sus clientes, empleados, proveedores y contactos incorpora al Servicio y para qué los utiliza. En ese contexto, el Cliente es el responsable y Grafoprint actúa como encargado o prestador de tratamiento, procesándolos según sus instrucciones, los Términos y la ley.</p>
    <p>Las personas cuyos datos fueron cargados por una imprenta deben dirigir inicialmente sus solicitudes a esa imprenta. Grafoprint colaborará con el tenant para atenderlas.</p>
  </> },
  { id: "datos", title: "3. Datos que tratamos", content: <>
    <ul><li><strong>Registro e identidad:</strong> nombre, empresa, correo, país, zona horaria, plan elegido y aceptación de documentos legales.</li><li><strong>Cuenta y acceso:</strong> identificadores, roles, permisos, hash de contraseña, sesiones, verificaciones y eventos de seguridad. No almacenamos contraseñas en texto legible.</li><li><strong>Facturación y suscripción:</strong> plan, estado, moneda, importes, comprobantes, identificadores del procesador de pagos y datos fiscales necesarios. Los datos completos de tarjeta son tratados por el proveedor de pagos, no por Grafoprint.</li><li><strong>Operación del tenant:</strong> clientes, contactos, productos, presupuestos, órdenes, archivos, inventario, producción, cobros, proveedores, empleados y configuraciones ingresadas por el Cliente.</li><li><strong>Uso y diagnóstico:</strong> dirección IP, dispositivo, navegador, fechas, acciones, errores, métricas técnicas, registros de auditoría y datos necesarios para prevenir fraude o abuso.</li><li><strong>Comunicaciones:</strong> consultas, soporte, encuestas, preferencias y comunicaciones transaccionales.</li><li><strong>Atribución comercial:</strong> origen de la visita y parámetros de campaña cuando existan.</li></ul>
    <p>Solicitamos no cargar datos sensibles salvo que sean estrictamente necesarios, exista base legal suficiente y se adopten las salvaguardas correspondientes.</p>
  </> },
  { id: "finalidades", title: "4. Para qué usamos los datos", content: <>
    <ul><li>crear, verificar, autenticar y administrar cuentas y tenants;</li><li>prestar las funciones contratadas, almacenar archivos y ejecutar instrucciones del Cliente;</li><li>procesar suscripciones, pagos, facturación y soporte;</li><li>mantener seguridad, auditoría, aislamiento, disponibilidad, respaldo y prevención de fraude;</li><li>diagnosticar errores, medir rendimiento y mejorar funciones;</li><li>cumplir obligaciones legales, fiscales, contables y requerimientos de autoridad;</li><li>enviar avisos operativos, legales, de seguridad y de servicio;</li><li>enviar comunicaciones comerciales sólo cuando exista autorización o una base legal aplicable, ofreciendo un mecanismo sencillo de baja.</li></ul>
  </> },
  { id: "bases", title: "5. Bases legales", content: <>
    <p>Según el caso, tratamos información para ejecutar el contrato o medidas precontractuales; cumplir obligaciones legales; atender intereses legítimos como seguridad, soporte y mejora del Servicio; o sobre la base del consentimiento, cuando resulte requerido.</p>
    <p>El consentimiento puede retirarse hacia el futuro sin afectar tratamientos anteriores ni aquellos necesarios por otra base legal.</p>
  </> },
  { id: "cookies", title: "6. Cookies y tecnologías locales", content: <>
    <p>Utilizamos cookies o almacenamiento local estrictamente necesarios para iniciar sesión, proteger la cuenta, recordar preferencias y mantener funciones de la aplicación. También podemos utilizar medición agregada para comprender rendimiento y uso.</p>
    <p>Si en el futuro incorporamos cookies publicitarias o analíticas no esenciales, se informarán y, cuando corresponda, se solicitará consentimiento antes de activarlas. El navegador permite eliminar o bloquear cookies, aunque algunas funciones pueden dejar de operar.</p>
  </> },
  { id: "destinatarios", title: "7. Proveedores y destinatarios", content: <>
    <p>No vendemos datos personales. Podemos compartirlos, en la medida necesaria, con:</p>
    <ul><li>infraestructura, base de datos, alojamiento, almacenamiento y distribución de archivos;</li><li>Resend u otros proveedores de correo transaccional;</li><li>Paddle u otros procesadores y administradores de suscripciones y pagos;</li><li>proveedores de monitoreo, seguridad, soporte y comunicaciones;</li><li>integraciones elegidas por el Cliente, como ARCA/AFIP, Mercado Pago, Meta/WhatsApp o WATI;</li><li>asesores profesionales sujetos a confidencialidad;</li><li>autoridades cuando exista obligación legal, orden válida o necesidad de proteger derechos y seguridad.</li></ul>
    <p>Los proveedores sólo reciben los datos necesarios para su función y quedan sujetos a obligaciones contractuales de confidencialidad, seguridad y tratamiento.</p>
  </> },
  { id: "transferencias", title: "8. Alojamiento y transferencias internacionales", content: <>
    <p>La infraestructura principal puede operar en Argentina y/o la región de Sudamérica, incluyendo Brasil. Algunos proveedores tecnológicos y de pagos pueden procesar información en Estados Unidos, Reino Unido, la Unión Europea u otros países.</p>
    <p>Cuando exista una transferencia internacional, aplicaremos los mecanismos exigidos por la Ley 25.326 y la normativa de la Agencia de Acceso a la Información Pública, como países con protección adecuada, cláusulas contractuales modelo, consentimiento u otra excepción legal válida.</p>
  </> },
  { id: "conservacion", title: "9. Conservación y eliminación", content: <>
    <p>Conservamos datos mientras la cuenta esté activa y durante el tiempo necesario para prestar el Servicio, resolver disputas, prevenir fraude y cumplir obligaciones legales, fiscales, contables y de seguridad.</p>
    <p>Al finalizar la relación, el Cliente podrá solicitar o realizar una exportación dentro del plazo operativo informado. Luego los datos se eliminarán o anonimizarán conforme a los ciclos de respaldo y retención, salvo aquello que deba conservarse por ley o para defender derechos. Las copias de respaldo se depuran progresivamente y permanecen protegidas mientras existan.</p>
  </> },
  { id: "seguridad", title: "10. Seguridad e incidentes", content: <>
    <p>Aplicamos medidas técnicas y organizativas proporcionales al riesgo, incluyendo autenticación, permisos por rol, aislamiento entre tenants, cifrado o protección de secretos, auditoría, copias y controles sobre proveedores. Revisamos estas medidas conforme evoluciona el Servicio.</p>
    <p>Ningún sistema puede garantizar seguridad absoluta. Si detectamos un incidente que afecte datos personales, investigaremos, mitigaremos y notificaremos al Cliente, a las personas o a la autoridad cuando corresponda legalmente.</p>
  </> },
  { id: "derechos", title: "11. Derechos de las personas", content: <>
    <p>Las personas pueden solicitar información, acceso, rectificación, actualización, supresión o bloqueo de sus datos, y retirar su consentimiento cuando corresponda. Para proteger la información podemos pedir acreditación razonable de identidad.</p>
    <p>Los pedidos de acceso serán respondidos dentro de los plazos legales; los de rectificación, actualización o supresión se atenderán en el plazo aplicable. El ejercicio es gratuito conforme a la Ley 25.326.</p>
    <p>La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, recibe denuncias y reclamos. Podés consultar los procedimientos oficiales en <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noreferrer">argentina.gob.ar/aaip</a>.</p>
  </> },
  { id: "menores", title: "12. Menores de edad", content: <>
    <p>Grafoprint es un servicio profesional para empresas y no está dirigido a menores de edad. No recopilamos deliberadamente datos de menores para crear cuentas. Si se detecta un registro indebido, se adoptarán medidas para eliminarlo.</p>
  </> },
  { id: "automatizacion", title: "13. Automatización y decisiones", content: <>
    <p>El Servicio automatiza cálculos, alertas, estimaciones, rutas y procesos configurados por el Cliente. Estas salidas apoyan la operación, pero no adoptamos decisiones legales o de efecto significativo sobre personas exclusivamente de manera automatizada por cuenta propia.</p>
  </> },
  { id: "cambios", title: "14. Cambios a esta Política", content: <>
    <p>Podemos actualizar esta Política por cambios legales, técnicos o de proveedores. Publicaremos la nueva versión y notificaremos cambios materiales por medios razonables. Los cambios regirán hacia el futuro desde la fecha indicada.</p>
  </> },
];

export default function PrivacidadPage() {
  return <LegalDocument eyebrow="Privacidad y datos" title="Política de privacidad" intro="Esta Política explica qué información trata Grafoprint, por qué lo hace, con quién puede compartirla y cómo pueden ejercer sus derechos las personas." notice={<>La privacidad es una responsabilidad compartida: Grafoprint protege y procesa la plataforma; cada tenant debe informar a sus propios clientes y colaboradores y contar con una base legal para los datos que incorpora.</>} sections={sections} />;
}
