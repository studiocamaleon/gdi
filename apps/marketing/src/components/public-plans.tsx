import { ArrowUpRight, Check, Layers3, Users } from "lucide-react";
import { connection } from "next/server";
import {
  getPublicPlans,
  planSignup,
  type PublicPlan,
} from "../lib/public-plans";
import { getSiteConfig, planInquiry } from "../lib/site-config";
import { PlanComparison } from "./plan-comparison";

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
function resources(plan: PublicPlan) {
  const result: string[] = [];
  const { usuariosMax, storageGb, ordenesMesMax } = plan.features;
  if (typeof usuariosMax === "number")
    result.push(
      usuariosMax > 0
        ? `${number.format(usuariosMax)} usuarios incluidos`
        : "Usuarios ilimitados",
    );
  if (typeof storageGb === "number")
    result.push(`${number.format(storageGb)} GB de almacenamiento`);
  if (typeof ordenesMesMax === "number" && ordenesMesMax > 0)
    result.push(`${number.format(ordenesMesMax)} órdenes por mes`);
  return result;
}

export async function PublicPlans({
  signup,
  demo,
}: {
  signup: string;
  demo: string;
}) {
  const site = getSiteConfig();
  if (!site.isLive)
    return (
      <div className="plans-prelaunch" id="comparar-planes">
        <span className="eyebrow">PRÓXIMAMENTE</span>
        <h3>Estamos preparando el lanzamiento.</h3>
        <p>
          Los planes, el registro y el acceso a Grafoprint se habilitarán cuando
          lancemos el sistema. Mientras tanto, podés conocer sus funciones y
          conversar con nuestro equipo.
        </p>
        <a className="button button-orange" href={site.contact}>
          Hablemos de tu gráfica <ArrowUpRight size={16} />
        </a>
      </div>
    );
  // Nunca fijar en el build una oferta ni una falla de configuración de la API.
  await connection();
  const plans = await getPublicPlans();
  if (!plans?.length)
    return (
      <div className="plans-unavailable" role="status">
        <p>
          {plans
            ? "Estamos preparando la próxima oferta de Grafo."
            : "No pudimos cargar los planes en este momento."}
        </p>
        <a className="button button-outline" href={demo}>
          Consultar al equipo <ArrowUpRight size={16} />
        </a>
      </div>
    );
  return (
    <>
      <div className="plan-grid">
        {plans.map((plan, index) => {
          const consult = plan.precioAConsultar || plan.precioMensual == null;
          const signupAvailable = plan.registroPublico && !consult;
          return (
            <article
              className={`plan-card ${plan.recomendado ? "plan-featured" : ""}`}
              key={plan.codigo}
            >
              <div className="plan-top">
                <Layers3 size={24} />
                <span>
                  {plan.recomendado
                    ? "RECOMENDADO"
                    : String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3>{plan.nombre}</h3>
              <p className="plan-intro">{plan.descripcion}</p>
              <div
                className={`plan-price ${consult ? "plan-price-custom" : ""}`}
              >
                {!consult && (
                  <span className="plan-currency">{plan.moneda}</span>
                )}
                <strong>
                  {consult ? "A consultar" : number.format(plan.precioMensual!)}
                </strong>
                {!consult && <span className="plan-period">/mes</span>}
              </div>
              <p className="plan-price-note">
                {signupAvailable && plan.trialDias
                  ? `${plan.trialDias} días gratis · Sin tarjeta`
                  : "Consultá las condiciones del plan"}
                {!consult && (
                  <>
                    <br />
                    {plan.ofertaId
                      ? "Impuestos no incluidos"
                      : "Impuestos según tu país"}
                  </>
                )}
              </p>
              {plan.implementacion && (
                <p className="plan-extra">
                  Implementación: {plan.moneda}{" "}
                  {number.format(plan.implementacion.importe)} · pago único al
                  contratar.
                </p>
              )}
              {plan.anual && (
                <p className="plan-extra">
                  Facturación anual: {plan.moneda}{" "}
                  {number.format(plan.anual.importe)} /año
                </p>
              )}
              <div className="plan-inheritance">
                <Users size={16} />
                <strong>Para tu equipo</strong>
              </div>
              <ul>
                {resources(plan).map((resource) => (
                  <li key={resource}>
                    <Check size={15} />
                    {resource}
                  </li>
                ))}
              </ul>
              {plan.usuarioMensual && (
                <p className="plan-extra">
                  Usuario adicional: {plan.moneda}{" "}
                  {number.format(plan.usuarioMensual.importe)} /mes
                  {plan.usuarioAnual && (
                    <>
                      {" "}
                      · {plan.moneda} {number.format(plan.usuarioAnual.importe)}{" "}
                      /año
                    </>
                  )}
                </p>
              )}
              <a
                href={
                  signupAvailable
                    ? planSignup(signup, plan)
                    : planInquiry(demo, plan.nombre)
                }
                className={`button ${plan.recomendado ? "button-orange" : "button-outline"}`}
              >
                {signupAvailable ? "Empezar prueba" : "Consultar plan"}{" "}
                <ArrowUpRight size={16} />
              </a>
            </article>
          );
        })}
      </div>
      <PlanComparison plans={plans} />
    </>
  );
}
