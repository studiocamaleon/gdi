// Biblioteca · root app — library + wizard.

function App() {
  // Default: wizard open at step 2 for PVC_ESPUMADO so the design is immediately
  // visible. Click anywhere on backdrop to close, click another card to install another.
  const [wizardKey, setWizardKey] = React.useState("PVC_ESPUMADO");

  return (
    <div>
      {/* Topbar (mimics Grafoprint shell) */}
      <div className="bm-topbar">
        <div className="crumbs">
          <span>Inventario</span>
          <span className="sep">/</span>
          <span>Materias primas</span>
          <span className="sep">/</span>
          <span className="here">Biblioteca</span>
        </div>
        <div className="spacer" />
        <div className="actions">
          <button className="bm-btn ghost">Documentación</button>
          <button className="bm-btn">Sugerencias</button>
        </div>
      </div>

      <Library onConfigure={(k) => setWizardKey(k)} />

      {wizardKey && (
        <Wizard
          canonicalKey={wizardKey}
          onClose={() => setWizardKey(null)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
