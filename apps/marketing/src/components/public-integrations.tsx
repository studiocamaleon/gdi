import { Bot, FileCheck2, MessageCircle, Printer } from "lucide-react";
import { connection } from "next/server";
import { getPublicPlans } from "../lib/public-plans";
import { publicIntegrations } from "../lib/public-integrations";
import { isMarketingLive } from "../lib/site-config";

const icons = {
  invoice: FileCheck2,
  message: MessageCircle,
  assistant: Bot,
  printer: Printer,
};

export async function PublicIntegrations() {
  if (!isMarketingLive()) return null;
  await connection();
  const plans = await getPublicPlans();
  if (!plans) return null;
  const integrations = publicIntegrations(plans);
  if (!integrations.length) return null;

  return (
    <section
      className="integrations-section section-shell"
      id="integraciones"
      aria-labelledby="integrations-title"
    >
      <div>
        <span className="eyebrow dark-eyebrow">INTEGRACIONES</span>
        <h2 id="integrations-title">
          Tu operación,
          <br />
          <span>sin islas.</span>
        </h2>
        <p>
          Conectá las herramientas que usás cada día con la información de tus
          trabajos.
        </p>
        <a className="integration-compare-link" href="#comparar-planes">
          Comparar disponibilidad por plan <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="integration-list">
        {integrations.map((integration) => {
          const Icon = icons[integration.icon];
          return (
            <div key={integration.key}>
              <span className="integration-monogram">
                <Icon size={21} aria-hidden="true" />
              </span>
              <div className="integration-detail">
                <strong>{integration.name}</strong>
                <small>{integration.description}</small>
                <span className="integration-requirement">
                  {integration.requirement}
                </span>
                <span className="integration-plans">
                  {integration.plans.join(" · ")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
