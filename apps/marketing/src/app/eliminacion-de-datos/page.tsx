import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalDocument,
  type LegalSection,
} from "../../components/legal/legal-document";

const title = "Eliminación de datos | Grafoprint";
const description =
  "Cómo solicitar la eliminación de datos personales o de WhatsApp, desconectar una integración y dar de baja una cuenta de Grafoprint.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/eliminacion-de-datos" },
  openGraph: { title, description, url: "/eliminacion-de-datos" },
  twitter: { card: "summary", title, description },
};

const sections: LegalSection[] = [
  {
    id: "alcance",
    title: "1. Qué podés solicitar",
    content: (
      <>
        <p>
          <strong>GRUPO IDEA SAS</strong>, bajo la marca Grafoprint, recibe
          solicitudes sobre los datos que trata en el sitio, la aplicación y sus
          integraciones, incluidos los datos obtenidos a través de Meta y
          WhatsApp. No necesitás iniciar sesión para hacer un pedido.
        </p>
        <ul>
          <li>
            <strong>Desconectar WhatsApp:</strong> detener el uso de la
            conexión. Esto no equivale a borrar los datos ya guardados.
          </li>
          <li>
            <strong>Eliminar datos de la integración:</strong> solicitar la
            supresión de datos de conexión, contactos, conversaciones, archivos
            o registros de mensajes bajo el control de Grafoprint, sin tener que
            cerrar toda la cuenta.
          </li>
          <li>
            <strong>Eliminar datos personales:</strong> pedir la supresión de
            tus datos, aunque seas cliente o contacto de una empresa que usa
            Grafoprint y no tengas una cuenta propia.
          </li>
          <li>
            <strong>Dar de baja una cuenta:</strong> solicitar el cierre de la
            cuenta y la eliminación de sus datos. Si además querés cancelar una
            suscripción, indicalo en el pedido para que se gestione conforme a
            los
            <Link href="/terminos#cancelacion"> Términos de servicio</Link>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "solicitud",
    title: "2. Cómo enviar la solicitud",
    content: (
      <>
        <p>
          Escribí a{" "}
          <a href="mailto:soporte@grafoprint.com.ar?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos">
            soporte@grafoprint.com.ar
          </a>{" "}
          con el asunto <strong>“Solicitud de eliminación de datos”</strong> e
          incluí lo siguiente:
        </p>
        <ol>
          <li>
            Tu nombre y un correo donde podamos responderte. Si tenés una
            cuenta, usá preferentemente su correo de registro.
          </li>
          <li>
            El nombre de tu empresa o de la imprenta con la que te comunicaste,
            para localizar los datos correctos.
          </li>
          <li>
            Qué solicitás: desconexión, eliminación de datos concretos o baja
            completa. Describí los datos afectados y, si corresponde a WhatsApp,
            el número involucrado con código de país.
          </li>
          <li>
            Si actuás por una empresa o por otra persona, indicá en qué carácter
            lo hacés. Te pediremos sólo la acreditación necesaria para verificar
            esa representación.
          </li>
        </ol>
        <p>
          No envíes contraseñas, tokens, códigos de verificación ni copias de
          documentos de identidad en el primer mensaje. Si necesitamos verificar
          tu identidad, te indicaremos un medio adecuado y la información mínima
          necesaria. Si ya no tenés acceso al correo de tu cuenta, explicalo
          para que podamos evaluar otra forma de verificación.
        </p>
      </>
    ),
  },
  {
    id: "tramite",
    title: "3. Cómo se tramita",
    content: (
      <>
        <ol>
          <li>
            Soporte revisa el pedido, verifica la identidad o representación
            cuando corresponde y precisa el alcance si falta información.
          </li>
          <li>
            Identificamos los datos y al responsable de su tratamiento. Si
            pertenecen a la operación de una imprenta, coordinamos con ella como
            responsable para atender tu solicitud, respetando tus derechos.
          </li>
          <li>
            Si pedís cerrar una cuenta o borrar información de toda una empresa,
            confirmamos el alcance con una persona autorizada antes de una
            acción irreversible. Podés solicitar una exportación; soporte te
            informará las opciones disponibles.
          </li>
          <li>
            Ejecutamos la supresión o anonimización que corresponda y
            gestionamos el pedido con los proveedores que traten esos datos por
            nuestra cuenta. Respondemos por correo con el resultado y cualquier
            conservación obligatoria, su motivo y plazo.
          </li>
        </ol>
        <p>
          La solicitud se atiende por soporte; enviar el correo no inicia un
          borrado automático. Podés consultar su estado respondiendo en el mismo
          hilo. La verificación y la coordinación se realizan dentro de los
          plazos legales aplicables.
        </p>
      </>
    ),
  },
  {
    id: "whatsapp",
    title: "4. Alcance en Meta y WhatsApp",
    content: (
      <>
        <p>
          Si tenés acceso como administrador, podés usar la opción de
          desconexión disponible en Configuración → Integraciones o pedirla a
          soporte. También podés retirar los permisos desde las opciones que
          ofrezca Meta o el proveedor de tu conexión. Para eliminar información
          ya almacenada en Grafoprint, enviá la solicitud del apartado anterior.
        </p>
        <p>
          La eliminación puede abarcar los datos recibidos mediante la
          integración: identificadores de cuenta y número, credenciales,
          contactos, mensajes, adjuntos, estados e historial sincronizado, según
          lo que se haya almacenado y el alcance del pedido. Si mantenés la
          integración activa, nuevos mensajes o sincronizaciones autorizadas
          pueden volver a generar datos; para detenerlo, solicitá también la
          desconexión.
        </p>
        <p>
          Eliminar información en Grafoprint no elimina tu número, tu cuenta de
          WhatsApp ni las copias de mensajes en el celular de otros
          participantes. Tampoco borra automáticamente datos que Meta, WATI u
          otros proveedores conserven por sus propias finalidades u
          obligaciones. En esos casos, corresponde ejercer los derechos también
          ante el proveedor respectivo.
        </p>
      </>
    ),
  },
  {
    id: "plazos",
    title: "5. Plazos y conservación",
    content: (
      <>
        <p>
          Atendemos los pedidos conforme a la normativa aplicable. En Argentina,
          la Ley 25.326 establece un máximo de cinco días hábiles desde la
          recepción del reclamo para rectificación, actualización o supresión
          cuando corresponda. Para el acceso a datos, el plazo es de diez días
          corridos desde la intimación fehaciente. Estos plazos no se reemplazan
          por un plazo comercial de soporte.
        </p>
        <p>
          La supresión puede estar limitada por obligaciones legales de
          conservación o por derechos legítimos de terceros. Si aplica una
          excepción, te informaremos los datos afectados, su fundamento y el
          plazo de conservación; no usaremos esa excepción para mantenerlos
          disponibles para fines incompatibles.
        </p>
        <p>
          Las copias de respaldo que aún contengan datos eliminados permanecerán
          protegidas y fuera del uso habitual hasta su depuración. Informaremos
          el plazo aplicable y evitaremos reincorporar esos datos al uso activo
          si se recupera un respaldo. Esto no amplía los plazos legales ni
          permite una conservación indefinida.
        </p>
        <p>
          Consultá los artículos 14 y 16 de la{" "}
          <a
            href="https://www.argentina.gob.ar/normativa/nacional/64790/actualizacion"
            target="_blank"
            rel="noreferrer"
          >
            Ley 25.326
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "derechos",
    title: "6. Consultas y reclamos",
    content: (
      <>
        <p>
          Para más información sobre el tratamiento de datos y tus derechos,
          consultá nuestra{" "}
          <Link href="/privacidad">Política de privacidad</Link>. Si considerás
          que tu solicitud no fue atendida adecuadamente, podés presentar un
          reclamo ante la{" "}
          <a
            href="https://www.argentina.gob.ar/aaip/datospersonales/derechos"
            target="_blank"
            rel="noreferrer"
          >
            Agencia de Acceso a la Información Pública
          </a>
          .
        </p>
      </>
    ),
  },
];

export default function EliminacionDeDatosPage() {
  return (
    <LegalDocument
      path="/eliminacion-de-datos"
      eyebrow="Privacidad y control"
      title="Eliminación de datos"
      intro="Podés solicitar la eliminación de tus datos, incluidos los vinculados con Meta y WhatsApp, sin necesidad de iniciar sesión. Acá te explicamos cómo hacerlo y qué comprende cada pedido."
      notice={
        <>
          Desconectar WhatsApp, eliminar datos y cerrar tu cuenta son acciones
          diferentes. Indicá cuál necesitás para que atendamos tu pedido con el
          alcance correcto.
        </>
      }
      sections={sections}
    />
  );
}
