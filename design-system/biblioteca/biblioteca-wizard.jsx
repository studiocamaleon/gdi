// Biblioteca · Wizard sheet — install a canonical material into the tenant.
// 4 steps: Nombre · Variantes · Preview · Listo

const STEPS = [
  { key: "nombre",    nm: "Nombre",    sub: "visible en tu empresa" },
  { key: "variantes", nm: "Variantes", sub: "a instalar" },
  { key: "preview",   nm: "Preview",   sub: "qué se va a crear" },
  { key: "listo",     nm: "Listo",     sub: "instalación" },
];

/* ─────────── Step indicator ─────────── */
function Stepper({ current, onJump }) {
  return (
    <div className="bm-stepper">
      {STEPS.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "pending";
        return (
          <React.Fragment key={s.key}>
            <button className={`bm-step ${state}`} onClick={() => onJump(i)}>
              <span className="ix">{state === "done" ? <BIco.Check /> : i + 1}</span>
              <span className="lbl">
                {s.nm}
                <span className="sm">{s.sub}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && <span className={`bm-step-rule ${state === "done" ? "done" : ""}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─────────── Canonical recap (shown across steps) ─────────── */
function CanonicalRecap({ item }) {
  return (
    <div className="bm-canonical-recap">
      <span className="ic"><BIco.Library /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="lbl">Nombre canónico SaaS</div>
        <div className="v">{item.nombreCanonico}</div>
        <div className="meta">{item.canonicalKey} · {item.templateId}</div>
      </div>
      <span className="bm-canonical-pill">
        <span className="ic"><BIco.Sparkles /></span>
        Biblioteca
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  STEP 1 · Nombre visible                                    */
/* ═══════════════════════════════════════════════════════════ */
function StepNombre({ item, draft, setDraft }) {
  const [customMode, setCustomMode] = React.useState(
    draft.visibleName && !item.aliasDisponibles.includes(draft.visibleName)
  );

  const setAlias = (a) => {
    setCustomMode(false);
    setDraft(d => ({ ...d, visibleName: a }));
  };
  const setCustom = () => {
    setCustomMode(true);
    if (item.aliasDisponibles.includes(draft.visibleName)) {
      setDraft(d => ({ ...d, visibleName: "" }));
    }
  };

  return (
    <>
      <div className="bm-section">
        <CanonicalRecap item={item} />
      </div>

      <div className="bm-section">
        <div className="bm-section-head">
          <div className="ttl">Nombre visible en tu empresa</div>
          <div className="sub">Elegí cómo llama tu equipo a este material. Será el nombre que aparezca en cotizaciones, órdenes y consumos.</div>
        </div>

        <div className="bm-field" style={{ marginBottom: 14 }}>
          <input
            className="bm-input lg"
            value={draft.visibleName}
            onChange={(e) => {
              setCustomMode(true);
              setDraft(d => ({ ...d, visibleName: e.target.value }));
            }}
            placeholder="Nombre visible…"
          />
        </div>

        <div className="bm-field">
          <label>O elegí un alias común</label>
          <div className="bm-alias-grid">
            {item.aliasDisponibles.map(a => (
              <button
                key={a}
                className={`bm-alias ${!customMode && draft.visibleName === a ? "on" : ""}`}
                onClick={() => setAlias(a)}
              >
                {a}
              </button>
            ))}
            <button
              className={`bm-alias custom ${customMode ? "on" : ""}`}
              onClick={setCustom}
            >
              {customMode ? "Personalizado" : "+ Personalizado"}
            </button>
          </div>
        </div>

        <div className="bm-mapping">
          <div className="col">
            <div className="k"><BIco.Library /> Canónico SaaS</div>
            <div className="v">{item.nombreCanonico}</div>
            <div className="meta">{item.canonicalKey}</div>
          </div>
          <div className="arrow"><BIco.Arrow /></div>
          <div className="col">
            <div className="k"><BIco.Cube /> Visible en tu empresa</div>
            <div className="v">{draft.visibleName || "—"}</div>
            <div className="meta">se mostrará en inventario</div>
          </div>
        </div>

        <div className="bm-field-help" style={{ marginTop: 10 }}>
          <span className="ic"><BIco.Info /></span>
          El sistema conservará <strong style={{ color: "var(--ink-2)" }}>{item.nombreCanonico}</strong> como nombre canónico para reportes cross-tenant y compatibilidad técnica. Vos podés cambiar el nombre visible cuando quieras.
        </div>
      </div>

      <div className="bm-section">
        <div className="bm-section-head">
          <div className="ttl">Código y descripción</div>
          <div className="sub">Opcional. Se autogeneran a partir del canónico.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 10 }}>
          <div className="bm-field">
            <label>Código <span className="opt">interno</span></label>
            <input className="bm-input mono" value={draft.codigo} onChange={(e) => setDraft(d => ({ ...d, codigo: e.target.value }))} />
          </div>
          <div className="bm-field">
            <label>Descripción <span className="opt">corta</span></label>
            <input className="bm-input" value={draft.descripcion} onChange={(e) => setDraft(d => ({ ...d, descripcion: e.target.value }))} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  STEP 2 · Variantes                                          */
/* ═══════════════════════════════════════════════════════════ */
function StepVariantes({ item, draft, setDraft }) {
  const groups = React.useMemo(() => {
    const g = {};
    item.variantes.forEach(v => {
      if (!g[v.formato]) g[v.formato] = [];
      g[v.formato].push(v);
    });
    return g;
  }, [item]);

  const isChecked = (sku) => draft.selectedSkus.has(sku);
  const isInstalled = (sku) => item.variantes.find(v => v.sku === sku)?.instalada;

  const toggle = (sku) => {
    if (isInstalled(sku)) return;
    setDraft(d => {
      const next = new Set(d.selectedSkus);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return { ...d, selectedSkus: next };
    });
  };

  const selectGroup = (skus, sel) => {
    setDraft(d => {
      const next = new Set(d.selectedSkus);
      skus.forEach(s => {
        if (isInstalled(s)) return;
        if (sel) next.add(s);
        else next.delete(s);
      });
      return { ...d, selectedSkus: next };
    });
  };

  const selectAll = (sel) => {
    setDraft(d => {
      const next = new Set();
      if (sel) item.variantes.forEach(v => { if (!v.instalada) next.add(v.sku); });
      return { ...d, selectedSkus: next };
    });
  };
  const selectRecommended = () => {
    setDraft(d => {
      const next = new Set();
      item.variantes.forEach(v => { if (v.recomendada && !v.instalada) next.add(v.sku); });
      return { ...d, selectedSkus: next };
    });
  };

  const selectedCount = [...draft.selectedSkus].filter(s => !isInstalled(s)).length;
  const totalAvailable = item.variantes.filter(v => !v.instalada).length;

  return (
    <>
      <div className="bm-section">
        <CanonicalRecap item={item} />
      </div>

      <div className="bm-section">
        <div className="bm-section-head">
          <div className="ttl">Variantes a instalar</div>
          <div className="sub">Seleccioná las medidas, espesores y colores que realmente usás. Podés agregar variantes personalizadas o ajustar más adelante.</div>
        </div>

        <div className="bm-variant-actions">
          <button className="quick" onClick={selectRecommended}>Seleccionar comunes</button>
          <button className="quick" onClick={() => selectAll(true)}>Todas</button>
          <button className="quick" onClick={() => selectAll(false)}>Limpiar</button>
          <div className="sum">
            <strong>{selectedCount}</strong> de {totalAvailable} seleccionadas
          </div>
        </div>

        {Object.entries(groups).map(([fmt, vars]) => {
          const selectableInGroup = vars.filter(v => !v.instalada).map(v => v.sku);
          const allSelected = selectableInGroup.length > 0 && selectableInGroup.every(s => draft.selectedSkus.has(s));
          const someSelected = selectableInGroup.some(s => draft.selectedSkus.has(s));
          return (
            <div key={fmt} className="bm-variant-group">
              <div className="bm-variant-group-head">
                <span className="nm">Formato {fmt}</span>
                <span className="ct">{vars.length} variantes</span>
                <span
                  className="toggle-all"
                  onClick={() => selectGroup(selectableInGroup, !allSelected)}
                >
                  {allSelected ? "Quitar todas" : someSelected ? "Seleccionar todas" : "Seleccionar todas"}
                </span>
              </div>
              {vars.map(v => {
                const installed = v.instalada;
                const checked = installed || draft.selectedSkus.has(v.sku);
                return (
                  <div
                    key={v.sku}
                    className={`bm-variant ${checked ? "checked" : ""} ${installed ? "installed" : ""}`}
                    onClick={() => toggle(v.sku)}
                  >
                    <span className="bm-check">{checked && <BIco.Check />}</span>
                    <div className="bm-variant-info">
                      <div className="nm">
                        {v.espesor} mm · {v.color}
                        {v.recomendada && !installed && <span className="rec">recom.</span>}
                      </div>
                      <div className="sub">SKU sugerido · {v.sku}</div>
                    </div>
                    {installed ? (
                      <span className="bm-variant-installed-tag">ya instalada</span>
                    ) : (
                      <span style={{ width: 70 }} />
                    )}
                    <button className="bm-variant-edit" onClick={(e) => e.stopPropagation()}>
                      <BIco.Edit />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}

        <button className="bm-variant-add">
          <BIco.Plus />
          Agregar variante personalizada
        </button>

        {item.advertencias && item.advertencias.length > 0 && (
          <div className="bm-warning" style={{ marginTop: 14 }}>
            <span className="ic"><BIco.Warn /></span>
            <div>
              <strong>Advertencias del material</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 11.5, color: "var(--ink-2)" }}>
                {item.advertencias.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  STEP 3 · Preview                                            */
/* ═══════════════════════════════════════════════════════════ */
function StepPreview({ item, draft }) {
  const newSkus = [...draft.selectedSkus].filter(sku => !item.variantes.find(v => v.sku === sku)?.instalada);
  const isPartial = item.installState?.status === "partial";

  return (
    <>
      <div className="bm-section">
        <div className="bm-section-head">
          <div className="ttl">Revisá lo que se va a crear</div>
          <div className="sub">Verificá que la información sea correcta antes de instalar. Podés volver a editar cualquier paso.</div>
        </div>

        <div className="bm-preview-card">
          <div className="head">
            <div className="ic-box"><MaterialIcon kind={item.iconKind} size={28} /></div>
            <div style={{ flex: 1 }}>
              <h3>{draft.visibleName || "—"}</h3>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                {draft.codigo} · {newSkus.length} variantes nuevas
              </div>
            </div>
            <span className="bm-canonical-pill">
              <span className="ic"><BIco.Sparkles /></span>
              {item.canonicalKey}
            </span>
          </div>
          <div className="bm-preview-row">
            <span className="k">Nombre visible</span>
            <span className="v">{draft.visibleName}</span>
          </div>
          <div className="bm-preview-row">
            <span className="k">Nombre canónico</span>
            <span className="v">
              {item.nombreCanonico}
              <span style={{ color: "var(--muted)", marginLeft: 6, fontWeight: 400, fontSize: 11.5 }}>conservado para reportes</span>
            </span>
          </div>
          <div className="bm-preview-row">
            <span className="k">Familia</span>
            <span className="v muted">Sustrato · Sustrato rígido</span>
          </div>
          <div className="bm-preview-row">
            <span className="k">Template</span>
            <span className="v mono">{item.templateId}</span>
          </div>
          <div className="bm-preview-row">
            <span className="k">Descripción</span>
            <span className="v muted">{draft.descripcion || item.descripcionCorta}</span>
          </div>
        </div>

        <div className="bm-preview-card">
          <div className="head">
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.005em", textTransform: "uppercase", color: "var(--muted)", margin: 0 }}>Variantes a instalar</h3>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                {newSkus.length} nuevas
              </div>
            </div>
          </div>
          <div className="bm-preview-list">
            {newSkus.length === 0 && (
              <div style={{ padding: "12px 0", color: "var(--muted)", fontSize: 12.5, textAlign: "center" }}>
                Sin variantes nuevas seleccionadas.
              </div>
            )}
            {newSkus.map(sku => {
              const v = item.variantes.find(x => x.sku === sku);
              if (!v) return null;
              return (
                <div key={sku} className="bm-preview-item">
                  <span className="ic"><BIco.CheckCircle /></span>
                  <span className="nm">{v.formato} · {v.espesor} mm · {v.color}</span>
                  <span className="sku">{v.sku}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isPartial && (
          <div className="bm-dup">
            <div className="head">
              <span style={{ flex: "0 0 auto" }}><BIco.Warn /></span>
              <div>
                <strong>Ya existe una materia prima vinculada a {item.nombreCanonico}.</strong>
                <div style={{ marginTop: 4, color: "var(--ink-2)" }}>
                  Tenés instalado <strong style={{ fontWeight: 600 }}>{item.installState.visibleName}</strong> con {item.installState.installedCount} variantes. ¿Cómo querés proceder?
                </div>
              </div>
            </div>
            <div className="opts">
              <div className="opt sel">
                <span className="radio" />
                <span>Agregar sólo las {newSkus.length} variantes faltantes a {item.installState.visibleName}</span>
              </div>
              <div className="opt">
                <span className="radio" />
                <span>Crear como material separado con otro nombre</span>
              </div>
              <div className="opt">
                <span className="radio" />
                <span>Cancelar instalación</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  STEP 4 · Confirmación (success)                             */
/* ═══════════════════════════════════════════════════════════ */
function StepListo({ item, draft, onClose }) {
  const newCount = [...draft.selectedSkus].filter(sku => !item.variantes.find(v => v.sku === sku)?.instalada).length;
  return (
    <div className="bm-success">
      <div className="bm-success-ico">
        <BIco.CheckCircleFill />
      </div>
      <h2>Se instaló {draft.visibleName}</h2>
      <div className="sub">
        Tu equipo ya puede usar este material en cotizaciones y órdenes de trabajo.
        El sistema mantiene <strong style={{ color: "var(--ink-2)" }}>{item.nombreCanonico}</strong> como nombre canónico para reportes.
      </div>

      <div className="bm-success-summary">
        <div className="bm-success-stat">
          <div className="v">{newCount}</div>
          <div className="k">Variantes nuevas</div>
        </div>
        <div className="bm-success-stat">
          <div className="v">{item.templateId.split("_").slice(0,-1).map(s => s[0].toUpperCase() + s.slice(1)).join(" ")}</div>
          <div className="k">Template aplicado</div>
        </div>
        <div className="bm-success-stat">
          <div className="v">1</div>
          <div className="k">Materia prima</div>
        </div>
      </div>

      <div className="bm-success-actions">
        <button className="bm-btn primary lg" onClick={onClose}>Ver materia prima</button>
        <button className="bm-btn lg">Instalar otro material</button>
        <button className="bm-btn ghost lg">Ir a inventario</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Wizard sheet (main wrapper)                                 */
/* ═══════════════════════════════════════════════════════════ */
function Wizard({ canonicalKey, onClose }) {
  const item = getCatalogItem(canonicalKey);
  const [step, setStep] = React.useState(1); // start at step 2 (variants) — most distinctive
  const [draft, setDraft] = React.useState(() => {
    const recommended = new Set(
      item.variantes.filter(v => v.recomendada && !v.instalada).map(v => v.sku)
    );
    return {
      visibleName: item.installState?.visibleName || item.aliasDisponibles[1] || item.aliasDisponibles[0],
      codigo: item.canonicalKey,
      descripcion: item.descripcionCorta,
      selectedSkus: recommended,
    };
  });

  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep(s => Math.max(0, s - 1));

  const newSelectedCount = [...draft.selectedSkus].filter(s => !item.variantes.find(v => v.sku === s)?.instalada).length;

  return (
    <>
      <div className="bm-backdrop" onClick={onClose} />
      <div className="bm-sheet" role="dialog">
        <div className="bm-sheet-head">
          <div className="icon-box"><MaterialIcon kind={item.iconKind} size={28} /></div>
          <div className="body">
            <div className="eyebrow">
              <BIco.Library />
              <span>Biblioteca</span>
              <span style={{ color: "var(--muted-2)" }}>›</span>
              <span style={{ fontFamily: "var(--font-mono)", letterSpacing: 0 }}>{item.canonicalKey}</span>
            </div>
            <h2>Instalar {item.nombreCanonico}</h2>
            <div className="sub">Configurá cómo se llamará en tu empresa y qué variantes querés tener disponibles para cotizar.</div>
          </div>
          <button className="bm-sheet-close" onClick={onClose} aria-label="Cerrar">
            <BIco.X />
          </button>
        </div>

        <Stepper current={step} onJump={(i) => setStep(i)} />

        <div className="bm-sheet-body">
          {step === 0 && <StepNombre    item={item} draft={draft} setDraft={setDraft} />}
          {step === 1 && <StepVariantes item={item} draft={draft} setDraft={setDraft} />}
          {step === 2 && <StepPreview   item={item} draft={draft} />}
          {step === 3 && <StepListo     item={item} draft={draft} onClose={onClose} />}
        </div>

        {step < 3 && (
          <div className="bm-sheet-foot">
            <button className="bm-btn ghost" onClick={onClose}>Cancelar</button>
            <div className="spacer" />
            <span className="step-count">
              {step === 1 && <><strong style={{ color: "var(--ink)" }}>{newSelectedCount}</strong> variantes seleccionadas</>}
              {step === 0 && draft.visibleName && <>Nombre: <strong style={{ color: "var(--ink)", fontFamily: "var(--font-sans)" }}>{draft.visibleName}</strong></>}
              {step === 2 && <><strong style={{ color: "var(--ink)" }}>{newSelectedCount}</strong> ítems a crear</>}
            </span>
            {step > 0 && (
              <button className="bm-btn" onClick={prev}>
                <BIco.ChevLeft /> Atrás
              </button>
            )}
            <button className="bm-btn primary" onClick={next} disabled={step === 0 && !draft.visibleName}>
              {step === 2 ? "Instalar materia prima" : "Siguiente"}
              {step < 2 && <BIco.ChevRight />}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

Object.assign(window, { Wizard, Stepper, StepNombre, StepVariantes, StepPreview, StepListo });
