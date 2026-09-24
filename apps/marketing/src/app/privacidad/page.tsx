import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalDocument,
  type LegalSection,
} from "../../components/legal/legal-document";

const title = "Política de privacidad | Grafoprint";
const description =
  "Cómo Grafoprint trata los datos personales del sistema y sus integraciones, incluido WhatsApp, y cómo ejercer tus derechos.";
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacidad" },
  openGraph: { title, description, url: "/privacidad" },
  twitter: { card: "summary", title, description },
};

const sections: LegalSection[] = [
  {
    id: "responsable",
    title: "1. Responsable y alcance",
    content: (
      <>
        <p>
          <strong>GRUPO IDEA SAS</strong>, bajo la marca Grafoprint, es
          responsable del tratamiento de los datos personales utilizados para
          registrar cuentas, administrar suscripciones, prestar soporte, operar
          el sitio y mantener la relación comercial.
        </p>
        <p>
          Esta Política se aplica al sitio comercial, el registro, la aplicación
          Grafoprint y las comunicaciones relacionadas. No regula sitios o
          servicios de terceros enlazados, que tienen sus propias políticas.
        </p>
      </>
    ),
  },
  {
    id: "roles",
    title: "2. Nuestros roles sobre los datos",
    content: (
      <>
        <h3>Datos de cuenta y relación comercial</h3>
        <p>
          Grafoprint actúa como responsable respecto de los datos de
          administradores, usuarios, contactos comerciales, facturación,
          seguridad y uso de la plataforma.
        </p>
        <h3>Datos de cada empresa usuaria</h3>
        <p>
          Cada empresa que contrata Grafoprint (el Cliente) decide qué datos de
          sus clientes, empleados, proveedores y contactos incorpora al Servicio
          y para qué los utiliza. En ese contexto, el Cliente es el responsable
          y Grafoprint actúa como encargado o prestador de tratamiento,
          procesándolos según sus instrucciones, los Términos y la ley.
        </p>
        <p>
          Si tus datos fueron cargados por una imprenta, podés dirigir tu
          solicitud a esa empresa o escribirnos para que ayudemos a identificar
          al responsable y tramitar el pedido. No necesitás una cuenta de
          Grafoprint para contactarnos.
        </p>
      </>
    ),
  },
  {
    id: "datos",
    title: "3. Datos que tratamos",
    content: (
      <>
        <ul>
          <li>
            <strong>Registro e identidad:</strong> nombre, empresa, correo,
            país, zona horaria, plan elegido y aceptación de documentos legales.
          </li>
          <li>
            <strong>Cuenta y acceso:</strong> identificadores, roles, permisos,
            hash de contraseña, sesiones, verificaciones y eventos de seguridad.
            No almacenamos contraseñas en texto legible.
          </li>
          <li>
            <strong>Facturación y suscripción:</strong> plan, estado, moneda,
            importes, comprobantes, identificadores del procesador de pagos y
            datos fiscales necesarios. Los datos completos de tarjeta son
            tratados por el proveedor de pagos, no por Grafoprint.
          </li>
          <li>
            <strong>Operación de la empresa:</strong> clientes, contactos,
            productos, presupuestos, órdenes, archivos, inventario, producción,
            cobros, proveedores, empleados y configuraciones ingresadas por el
            Cliente.
          </li>
          <li>
            <strong>Uso y diagnóstico:</strong> dirección IP, dispositivo,
            navegador, fechas, acciones, errores, métricas técnicas, registros
            de auditoría y datos necesarios para prevenir fraude o abuso.
          </li>
          <li>
            <strong>Comunicaciones:</strong> consultas, soporte, encuestas,
            preferencias y comunicaciones transaccionales.
          </li>
          <li>
            <strong>Atribución comercial:</strong> origen de la visita y
            parámetros de campaña cuando existan.
          </li>
        </ul>
        <p>
          Solicitamos no cargar datos sensibles salvo que sean estrictamente
          necesarios, exista base legal suficiente y se adopten las salvaguardas
          correspondientes.
        </p>
      </>
    ),
  },
  {
    id: "whatsapp",
    title: "3.1. Datos de Meta y WhatsApp",
    content: (
      <>
        <p>
          Cuando el Cliente habilita una integración de WhatsApp, Grafoprint
          procesa los datos que esa conexión permite y que resultan necesarios
          para las funciones elegidas. La disponibilidad depende de la
          integración habilitada en su cuenta; esta Política no implica que
          todas las modalidades estén disponibles.
        </p>
        <ul>
          <li>
            <strong>Conexión de la empresa:</strong> identificadores y nombres
            del negocio y de la cuenta de WhatsApp Business, números de
            teléfono, permisos concedidos y credenciales o tokens necesarios
            para mantener la conexión.
          </li>
          <li>
            <strong>Contactos y conversaciones:</strong> números y nombres
            facilitados, contenido de mensajes y archivos enviados o recibidos,
            fechas y estados de envío, entrega y lectura, cuando la función los
            requiera y el proveedor los facilite.
          </li>
          <li>
            <strong>Plantillas y notificaciones:</strong> texto y estado de las
            plantillas, destinatario y datos del pedido, presupuesto,
            comprobante o evento que el Cliente decida comunicar.
          </li>
          <li>
            <strong>Sincronización autorizada:</strong> si se ofrece la conexión
            con WhatsApp Business del celular y el Cliente autoriza importar
            contactos o historial, se tratarán únicamente los datos incluidos en
            esa autorización y que WhatsApp permita sincronizar.
          </li>
        </ul>
        <p>
          Usamos estos datos para conectar la cuenta, ofrecer la bandeja de
          conversaciones cuando esté habilitada, enviar las notificaciones
          configuradas, gestionar plantillas, mostrar estados de mensajes y
          atender errores o consultas de soporte. No accedemos por esta conexión
          a conversaciones ajenas al alcance autorizado.
        </p>
        <p>
          No vendemos estos datos, no los utilizamos para campañas propias ni
          compartimos las conversaciones de una empresa con otras empresas
          usuarias. El acceso queda limitado a los usuarios autorizados del
          Cliente y al personal o proveedores que necesiten intervenir para
          prestar el servicio, bajo obligaciones de confidencialidad.
        </p>
        <p>
          El Cliente puede retirar permisos desde las opciones del proveedor,
          desconectar la integración o solicitarlo a soporte. La desconexión
          detiene el uso futuro de esa conexión, pero no elimina por sí sola los
          datos ya guardados. Para solicitar su supresión, consultá las{" "}
          <Link href="/eliminacion-de-datos">
            instrucciones de eliminación de datos
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "4. Para qué usamos los datos",
    content: (
      <>
        <ul>
          <li>
            crear, verificar, autenticar y administrar cuentas y espacios de
            trabajo;
          </li>
          <li>
            prestar las funciones contratadas, almacenar archivos y ejecutar
            instrucciones del Cliente;
          </li>
          <li>procesar suscripciones, pagos, facturación y soporte;</li>
          <li>
            mantener seguridad, auditoría, aislamiento, disponibilidad, respaldo
            y prevención de fraude;
          </li>
          <li>diagnosticar errores, medir rendimiento y mejorar funciones;</li>
          <li>
            cumplir obligaciones legales, fiscales, contables y requerimientos
            de autoridad;
          </li>
          <li>
            enviar avisos operativos, legales, de seguridad y de servicio;
          </li>
          <li>
            enviar comunicaciones comerciales sólo cuando exista autorización o
            una base legal aplicable, ofreciendo un mecanismo sencillo de baja.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "bases",
    title: "5. Bases legales",
    content: (
      <>
        <p>
          Según el caso, tratamos información necesaria para la relación
          contractual y la prestación del Servicio, para cumplir obligaciones
          legales o sobre la base del consentimiento, conforme a la Ley 25.326.
          Cuando una actividad requiera consentimiento específico, lo
          solicitaremos antes de realizarla; la aceptación de estos documentos
          no sustituye ese consentimiento.
        </p>
        <p>
          El consentimiento puede retirarse hacia el futuro sin afectar
          tratamientos anteriores ni aquellos necesarios por otra base legal.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "6. Cookies y tecnologías locales",
    content: (
      <>
        <p>
          Utilizamos cookies o almacenamiento local estrictamente necesarios
          para iniciar sesión, proteger la cuenta, recordar preferencias y
          mantener funciones de la aplicación. También podemos utilizar medición
          agregada para comprender rendimiento y uso.
        </p>
        <p>
          Si en el futuro incorporamos cookies publicitarias o analíticas no
          esenciales, se informarán y, cuando corresponda, se solicitará
          consentimiento antes de activarlas. El navegador permite eliminar o
          bloquear cookies, aunque algunas funciones pueden dejar de operar.
        </p>
      </>
    ),
  },
  {
    id: "destinatarios",
    title: "7. Proveedores y destinatarios",
    content: (
      <>
        <p>
          No vendemos datos personales. Podemos compartirlos, en la medida
          necesaria, con:
        </p>
        <ul>
          <li>
            infraestructura, base de datos, alojamiento, almacenamiento y
            distribución de archivos;
          </li>
          <li>Resend u otros proveedores de correo transaccional;</li>
          <li>
            Paddle u otros procesadores y administradores de suscripciones y
            pagos;
          </li>
          <li>
            proveedores de monitoreo, seguridad, soporte y comunicaciones;
          </li>
          <li>
            integraciones elegidas por el Cliente, como ARCA/AFIP, Mercado Pago,
            Meta/WhatsApp o WATI;
          </li>
          <li>asesores profesionales sujetos a confidencialidad;</li>
          <li>
            autoridades cuando exista obligación legal, orden válida o necesidad
            de proteger derechos y seguridad.
          </li>
        </ul>
        <p>
          Los proveedores sólo reciben los datos necesarios para su función y
          quedan sujetos a obligaciones contractuales de confidencialidad,
          seguridad y tratamiento.
        </p>
        <p>
          En las integraciones de WhatsApp intervienen Meta/WhatsApp y, cuando
          la conexión se realiza a través de WATI, también ese proveedor.
          Reciben los datos necesarios para vincular la cuenta, administrar
          plantillas y transmitir mensajes. Su tratamiento está sujeto a sus
          propias condiciones y políticas, incluida la{" "}
          <a
            href="https://www.whatsapp.com/legal/privacy-policy"
            target="_blank"
            rel="noreferrer"
          >
            Política de privacidad de WhatsApp
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "transferencias",
    title: "8. Alojamiento y transferencias internacionales",
    content: (
      <>
        <p>
          La infraestructura principal puede operar en Argentina y/o la región
          de Sudamérica, incluyendo Brasil. Algunos proveedores tecnológicos y
          de pagos pueden procesar información en Estados Unidos, Reino Unido,
          la Unión Europea u otros países.
        </p>
        <p>
          Cuando exista una transferencia internacional, aplicaremos los
          mecanismos exigidos por la Ley 25.326 y la normativa de la Agencia de
          Acceso a la Información Pública, como países con protección adecuada,
          cláusulas contractuales modelo, consentimiento u otra excepción legal
          válida.
        </p>
      </>
    ),
  },
  {
    id: "conservacion",
    title: "9. Conservación y eliminación",
    content: (
      <>
        <p>
          Conservamos datos mientras la cuenta esté activa y durante el tiempo
          necesario para prestar el Servicio, resolver disputas, prevenir fraude
          y cumplir obligaciones legales, fiscales, contables y de seguridad.
        </p>
        <p>
          Los datos de contactos, conversaciones y archivos de WhatsApp se
          conservan sólo mientras sean necesarios para las funciones autorizadas
          o exista un motivo legítimo de conservación conforme a la ley. Al
          finalizar la relación, el Cliente puede solicitar la exportación y
          eliminación de sus datos; soporte informará el alcance y las opciones
          disponibles antes de ejecutar una baja irreversible.
        </p>
        <p>
          Cuando corresponda la supresión, eliminaremos o anonimizaremos los
          datos afectados. Si existe una obligación legal de conservar parte de
          ellos, informaremos qué se retiene, por qué y durante cuánto tiempo.
          Las copias de respaldo que aún contengan información quedarán
          protegidas y fuera del uso habitual hasta su depuración; el plazo
          aplicable se informará en la respuesta. La retención técnica no
          habilita a reutilizar datos suprimidos ni a extender los plazos
          legales.
        </p>
        <p>
          El procedimiento, los plazos legales y la diferencia entre
          desconexión, eliminación y baja de cuenta se explican en{" "}
          <Link href="/eliminacion-de-datos">Eliminación de datos</Link>.
        </p>
      </>
    ),
  },
  {
    id: "seguridad",
    title: "10. Seguridad e incidentes",
    content: (
      <>
        <p>
          Aplicamos medidas técnicas y organizativas proporcionales al riesgo,
          incluyendo autenticación, permisos por rol, aislamiento entre
          empresas, cifrado o protección de secretos, auditoría, copias y
          controles sobre proveedores. Revisamos estas medidas conforme
          evoluciona el Servicio.
        </p>
        <p>
          Ningún sistema puede garantizar seguridad absoluta. Si detectamos un
          incidente que afecte datos personales, investigaremos, mitigaremos y
          notificaremos al Cliente, a las personas o a la autoridad cuando
          corresponda legalmente.
        </p>
      </>
    ),
  },
  {
    id: "derechos",
    title: "11. Derechos de las personas",
    content: (
      <>
        <p>
          Las personas pueden solicitar información, acceso, rectificación,
          actualización, supresión o bloqueo de sus datos, y retirar su
          consentimiento cuando corresponda, escribiendo a{" "}
          <a href="mailto:soporte@grafoprint.com.ar">
            soporte@grafoprint.com.ar
          </a>
          . Para proteger la información podemos pedir acreditación razonable de
          identidad, limitada a lo necesario.
        </p>
        <p>
          Los pedidos de acceso serán respondidos dentro de los plazos legales;
          los de rectificación, actualización o supresión se atenderán en el
          plazo aplicable. El ejercicio es gratuito conforme a la Ley 25.326.
        </p>
        <p>
          La Agencia de Acceso a la Información Pública, órgano de control de la
          Ley 25.326, recibe denuncias y reclamos. Podés consultar los
          procedimientos oficiales en{" "}
          <a
            href="https://www.argentina.gob.ar/aaip/datospersonales/derechos"
            target="_blank"
            rel="noreferrer"
          >
            argentina.gob.ar/aaip
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "menores",
    title: "12. Menores de edad",
    content: (
      <>
        <p>
          Grafoprint es un servicio profesional para empresas y no está dirigido
          a menores de edad. No recopilamos deliberadamente datos de menores
          para crear cuentas. Si se detecta un registro indebido, se adoptarán
          medidas para eliminarlo.
        </p>
      </>
    ),
  },
  {
    id: "automatizacion",
    title: "13. Automatización y decisiones",
    content: (
      <>
        <p>
          El Servicio automatiza cálculos, alertas, estimaciones, rutas y
          procesos configurados por el Cliente. Estas salidas apoyan la
          operación, pero no adoptamos decisiones legales o de efecto
          significativo sobre personas exclusivamente de manera automatizada por
          cuenta propia.
        </p>
      </>
    ),
  },
  {
    id: "cambios",
    title: "14. Cambios a esta Política",
    content: (
      <>
        <p>
          Podemos actualizar esta Política por cambios legales, técnicos o de
          proveedores. Publicaremos la nueva versión y notificaremos cambios
          materiales por medios razonables. Los cambios se aplicarán hacia el
          futuro desde su publicación o desde la fecha posterior que se
          comunique.
        </p>
      </>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <LegalDocument
      path="/privacidad"
      eyebrow="Privacidad y datos"
      title="Política de privacidad"
      intro="Esta Política explica qué información trata Grafoprint, por qué lo hace, con quién puede compartirla y cómo pueden ejercer sus derechos las personas."
      notice={
        <>
          La privacidad es una responsabilidad compartida: Grafoprint protege y
          procesa la plataforma; cada empresa usuaria debe informar a sus
          propios clientes y colaboradores y contar con una base legal para los
          datos que incorpora.
        </>
      }
      sections={sections}
    />
  );
}
