import { ArrowRight, Circle, Eye, EyeOff, Upload, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { NumberControl, Choice, Section, SwitchControl } from "./Controls";
import { DEFAULT_LIGHTBOX, resolveLightbox, LIGHTBOX_LAYERS, rimScrewsPerFace, snapTabsPerFace } from "../core/lightbox";
import { LIGHTBOX_SIDE_PROFILES, lightboxSideProfile } from "../core/lightbox-side";
import { LIGHTBOX_MOUNT_STYLES, mountMetadata } from "../core/lightbox-mount";
import type { LightboxParameters, Project, Layer, Model } from "../core/types";

export function LightboxOverview({project:p,onChange,model}:{project:Project;onChange:(p:Project)=>void;model:Model|null}) {
  const v=resolveLightbox(p.lightbox);
  const change=(patch:Partial<LightboxParameters>)=>onChange({...p,lightbox:{...v,...patch}});
  return <div className="joint-overview">
    <span className="eyebrow">BANDEROLA LUMINOSA</span>
    <h2>Dos caras.<br/>Un cartel propio.</h2>
    <p>Diseñá el cuerpo circular, sus frentes desmontables y el soporte de pared.</p>
    <Badge variant="secondary">Prototipo para ensayar</Badge>
    <div className="joint-symbol"><Circle /></div>
    <FieldGroup>
      <NumberControl label="Diámetro del cuerpo" value={v.diameter} min={200} max={800} onChange={diameter=>change({diameter})}/>
      <NumberControl label="Profundidad del cuerpo" value={v.depth} min={60} max={240} onChange={depth=>change({depth})}/>
      <Choice label="Fabricación del cuerpo y los aros" value={String(v.segments)} options={[{value:"1",label:"Cada uno en una pieza"},...[4,6,8,12].map(n=>({value:String(n),label:`Dividir cada uno en ${n} sectores`}))]} onChange={s=>change({segments:Number(s) as LightboxParameters["segments"]})}/>
    </FieldGroup>
    {model?.lightbox && <p className="fine-note">Área visible: Ø{model.lightbox.visibleDiameter.toFixed(1)} mm.<br/>Interior libre · iluminación por definir.</p>}
    <p className="fine-note">Los aros abrazan el lateral del cuerpo. Las dimensiones totales incluyen sus pestañas, el relieve del lateral y el brazo de pared.</p>
    {v.segments===1&&<p className="fine-note">Un cuerpo entero y dos aros enteros. Producción comprueba si entran en tu impresora y conserva las piezas sin dividirlas.</p>}
    <Button variant="outline" onClick={()=>onChange({...p,mode:"letters"})}><ArrowRight data-icon="inline-start"/>Volver al diseño de letras</Button>
  </div>;
}

export function LightboxEditor({project:p,onChange,component,onComponentChange,isolated,onIsolatedChange,section,onSectionChange}:{project:Project;onChange:(p:Project)=>void;component:Layer;onComponentChange:(v:Layer)=>void;isolated:boolean;onIsolatedChange:(v:boolean)=>void;section:boolean;onSectionChange:(v:boolean)=>void}){
  const v=resolveLightbox(p.lightbox);
  const change=(patch:Partial<LightboxParameters>)=>onChange({...p,lightbox:{...v,...patch}});
  const n=(key:keyof LightboxParameters,label:string,min:number,max:number,step=.1,unit="mm")=><NumberControl key={key} label={label} value={v[key] as number} min={min} max={max} step={step} unit={unit} slider onChange={value=>change({[key]:value})}/>;
  const face=component==="faceA"?"a":"b";
  const graphic=async(file:File|undefined)=>{
    if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>2_000_000){toast.error("Elegí PNG, JPEG o WebP de hasta 2 MB.");return;}
    try{
      const image=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});
      onChange({...p,faceArtwork:{a:p.faceArtwork?.a||"",b:p.faceArtwork?.b||"",[face]:image}});
    }catch{toast.error("No se pudo leer la gráfica.");}
  };
  return <div className="component-editor">
    <Choice label="Componente de la banderola" value={component} options={Object.entries(LIGHTBOX_LAYERS).map(([value,label])=>({value,label}))} onChange={s=>onComponentChange(s as Layer)}/>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" aria-pressed={isolated} onClick={()=>onIsolatedChange(!isolated)}>{isolated?<EyeOff data-icon="inline-start"/>:<Eye data-icon="inline-start"/>}{isolated?"Ver conjunto":"Aislar componente"}</Button>
      <Button size="sm" variant="outline" aria-pressed={section} onClick={()=>onSectionChange(!section)}>{section?"Cerrar sección":"Ver sección"}</Button>
    </div>
    {component==="boxBody" && <>
    <Section title="Lateral exterior"><FieldGroup>
      <Choice label="Perfil del lateral" value={v.sideProfile} options={Object.entries(LIGHTBOX_SIDE_PROFILES).map(([value,label])=>({value,label}))} onChange={value=>change({sideProfile:value as LightboxParameters["sideProfile"]})}/>
      {v.sideProfile!=="smooth"&&<>
        {n("sideRelief","Relieve hacia afuera",.5,15)}
        {(["zigzag","waves"].includes(v.sideProfile))&&n("sidePeriod","Paso del relieve",4,40,.5)}
        {(["waves","pedestal","bubble"].includes(v.sideProfile))&&n("sideShape","Forma del perfil",0,100,1,"%")}
        {v.sideProfile==="stack"&&<>{n("sideCount","Cantidad de frisos",1,12,1,"")}{n("sideGap","Separación entre frisos",0,10)}</>}
        {v.sideProfile==="bumper"&&n("sideFoot","Tramo recto del bumper",0,60)}
        {n("sideMargin","Margen junto a los aros",2,Math.max(2,Math.min(15,(v.depth-8)/2-v.rimOverlap)))}
        {(["pedestal","bumper","bubble"].includes(v.sideProfile))&&<SwitchControl label="Invertir hacia la otra cara" value={v.sideReverse} onChange={sideReverse=>change({sideReverse})}/>}
      </>}
    </FieldGroup>
    <LightboxSideDiagram params={v}/>
    <p className="section-caption">El perfil ocupa sólo la franja entre los aros. Agrega material por fuera y conserva el interior y los encastres cilíndricos. La zona de los soportes de pared queda lisa.</p>
    </Section>
    <Section title="Cuerpo y apoyos"><FieldGroup>
      {n("wall","Espesor de pared",5,12)}
      {n("seatWidth","Ancho del asiento",v.acrylicClearance+4,20)}
      {n("seatThickness","Espesor del asiento",2,6)}
      {n("jointClearance","Holgura de ensamble por lado",.1,.6,.05)}
      <SwitchControl label="Drenajes inferiores" value={v.drainage} onChange={drainage=>change({drainage})}/>
    </FieldGroup><p className="section-caption">{v.segments===1?"Cuerpo continuo en una sola pieza, sin juntas de sectores ni llaves de unión. Sólo conserva los asientos del acrílico y las uniones necesarias. El sistema LED queda por definir.":"Sectores unidos con llaves axiales de doble cola de milano. Las llaves se colocan antes de cerrar el acrílico A."}</p></Section></>}
    {(component==="faceA"||component==="faceB") && <>
      <Section title={`Acrílico ${face.toUpperCase()}`}><FieldGroup>
        {n(face==="a"?"acrylicA":"acrylicB","Espesor del acrílico",2,8)}
        {n("acrylicClearance","Holgura radial de ambos acrílicos",.2,Math.min(3,v.seatWidth-4,v.rimWidth-v.wall-4),.1)}
      </FieldGroup><p className="section-caption">Placa entera, extraíble hacia su propia cara. Validá holgura de dilatación y apoyo para el diámetro y material elegidos.</p></Section>
      <Section title={`Gráfica de la cara ${face.toUpperCase()}`}><FieldGroup><Field><FieldLabel htmlFor={`box-art-${face}`}>Imagen PNG, JPEG o WebP</FieldLabel><Input id={`box-art-${face}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void graphic(e.target.files?.[0])}/></Field></FieldGroup>
        {p.faceArtwork?.[face]&&<><img src={p.faceArtwork[face]} alt={`Gráfica ${face.toUpperCase()}`} className="w-full max-h-32 object-contain"/><Button variant="ghost" size="sm" onClick={()=>onChange({...p,faceArtwork:{a:p.faceArtwork?.a||"",b:p.faceArtwork?.b||"",[face]:""}})}>Quitar gráfica</Button></>}
        <p className="section-caption">Se ajusta sin deformar y se recorta al área visible. La cara B se lee desde su exterior. La gráfica no modifica el archivo de corte.</p>
      </Section>
    </>}
    {(component==="rimA"||component==="rimB")&&<>
      <FieldGroup><Field><FieldLabel id="rim-closure-label">Cierre de ambos aros</FieldLabel>
        <ToggleGroup variant="outline" aria-labelledby="rim-closure-label" value={[v.rimClosure]} onValueChange={values=>{
          const closure=values[0];
          if(closure==="snap"||closure==="screws")change({rimClosure:closure,...(closure==="snap"?{rimOverlap:Math.max(18,v.rimOverlap)}:{})});
        }}>
          <ToggleGroupItem value="snap">Click</ToggleGroupItem>
          <ToggleGroupItem value="screws">Tornillos laterales</ToggleGroupItem>
        </ToggleGroup>
      </Field></FieldGroup>
      <Section title="Aro que abraza el cuerpo"><FieldGroup>
        {n("rimWidth","Ancho del frente del aro",v.wall+v.acrylicClearance+4,35)}
        {n("rimThickness","Espesor del frente del aro",3,8)}
        {n("rimOverlap","Solape sobre el lateral",v.rimClosure==="snap"?18:Math.max(8,v.rimScrewHole+4),Math.min(35,(v.depth-(v.mount?v.armWidth+12:4))/2))}
        {n("rimSkirtThickness","Espesor de pestaña lateral",2,6)}
        {n("rimClearance","Holgura radial aro–cuerpo",.15,1,.05)}
      </FieldGroup><p className="section-caption">Perfil en L: el frente retiene el acrílico y la pestaña envuelve el cuerpo. Las medidas se comparten entre A y B. El aro se imprime apoyado sobre su frente.</p></Section>
      {v.rimClosure==="screws"?<Section title="Tornillos por el lateral"><FieldGroup>
        {n("rimScrewHole","Diámetro de paso en el aro",Math.max(2.5,v.rimPilotHole+.1),Math.min(5.5,v.rimOverlap-4))}
        {n("rimPilotHole","Diámetro piloto en el cuerpo",1.5,v.rimScrewHole-.1)}
        {n("rimScrewDepth","Profundidad del piloto ciego",2,v.wall-1)}
      </FieldGroup><p className="section-caption">{rimScrewsPerFace(v)} tornillos por aro ({rimScrewsPerFace(v)*2} en total). Tornillos comerciales adecuados para plástico, a probar con el filamento real. El piloto es liso, no una rosca. Límite geométrico de largo bajo cabeza: {(v.rimSkirtThickness+v.rimClearance+v.rimScrewDepth).toFixed(1)} mm; elegir un largo menor que no haga tope.</p><p className="section-caption">Retirá los tornillos laterales antes del despiece. El aro sale hacia su cara y luego se retira el acrílico. La tornillería no se genera como STL.</p></Section>:<Section title="Pestañas click desmontables"><FieldGroup>
        {n("snapThickness","Espesor de la pestaña flexible",.8,Math.min(2,v.rimSkirtThickness),.1)}
        {n("snapWidth","Ancho de la pestaña flexible",8,Math.min(18,Math.PI*v.diameter/snapTabsPerFace(v)-6),.5)}
        {n("snapEngagement","Retención del diente",.3,1.2,.05)}
      </FieldGroup><p className="section-caption">{snapTabsPerFace(v)} pestañas por aro, integradas en el faldón. Al entrar, los dientes traban en una ranura exterior del cuerpo. Frente liso y cierre sin tornillos.</p>
      <p className="section-caption">Para desmontar, levantá los uñeros hacia afuera y mantené las pestañas liberadas mientras retirás el aro. La vista de montaje muestra esa liberación antes de separarlo.</p>
      <p className="section-caption">Prototipo: el ajuste y las reaperturas se prueban con el filamento real. La animación no calcula fuerzas ni fatiga.</p></Section>}
    </>}
    {component==="keys"&&<Section title="Llaves de unión del cuerpo"><FieldGroup>{n("jointClearance","Holgura de ensamble por lado",.1,.6,.05)}</FieldGroup><p className="section-caption">Llaves para la división opcional del cuerpo. El brazo central se fija con tornillos interiores e insertos; no utiliza pasadores.</p></Section>}
    {component==="lightRails"&&<p className="fine-note">El sistema LED anterior fue retirado. El interior queda libre para definir otra solución.</p>}
    {component==="wallMount"&&<><SwitchControl label="Incluir soporte de pared" value={v.mount} onChange={mount=>change({mount})}/>{v.mount&&<>
      <Section title="Diseño del soporte"><FieldGroup><Field><FieldLabel id="mount-style-label">Tipo de soporte</FieldLabel>
        <ToggleGroup variant="outline" aria-labelledby="mount-style-label" value={[v.mountStyle]} onValueChange={values=>{
          const style=values[0];if(style==="classic"||style==="straight"||style==="arch")change({mountStyle:style});
        }}>
          {Object.entries(LIGHTBOX_MOUNT_STYLES).map(([value,option])=><ToggleGroupItem key={value} value={value}>{option.label}</ToggleGroupItem>)}
        </ToggleGroup>
      </Field></FieldGroup>
      <LightboxMountDiagram style={v.mountStyle}/>
      <p className="section-caption">{LIGHTBOX_MOUNT_STYLES[v.mountStyle].description}</p>
      <p className="section-caption">Un solo brazo central en los tres diseños. El círculo se imprime aparte, sin cunas salientes. Recto, Curvo y Clásico comparten las fijaciones interiores y pueden intercambiarse.</p>
      </Section>
      <Section title="Brazo central y placa"><FieldGroup>{n("wallDistance","Distancia del cuerpo a la pared",45,150)}{n("armHeight","Altura del cuello del brazo",14,30)}{n("armWidth","Ancho del brazo",28,Math.min(45,v.depth-2*v.rimOverlap-12))}{n("plateThickness","Espesor de placa de pared",8,18)}{n("anchorDiameter","Diámetro del anclaje comercial",4,10)}{n("cableDiameter","Canal de cable",3,v.armHeight-8)}</FieldGroup><p className="section-caption">Placa ensanchada con cuatro anclajes alrededor de un único brazo. El cable pasa por su centro. La plantilla a escala se incluye en el ZIP.</p></Section>
      <Section title="Tornillos ocultos desde adentro"><FieldGroup>
        {n("mountShoeThickness","Espesor del apoyo curvo",Math.max(6,v.mountInsertDepth+2.2),20)}
        {n("mountInsertDiameter","Diámetro del alojamiento del inserto",4.5,7)}
        {n("mountInsertDepth","Profundidad del alojamiento ciego",3.5,Math.min(12,v.mountShoeThickness-2.2))}
        {n("jointClearance","Holgura de ensamble por lado",.1,.6,.05)}
      </FieldGroup>
        <p className="section-caption">Cuatro tornillos M4 con arandela entran desde el interior del cuerpo y roscan en insertos del brazo. Sus alojamientos se abren sólo hacia el cuerpo: exterior cerrado, sin cabezas ni tuercas a la vista.</p>
        <p className="section-caption">Instalá los insertos por calor antes de unir el brazo y ajustá sus alojamientos al modelo comprado. Para desmontar, primero retirás aros y acrílicos y después accedés a los tornillos interiores.</p>
        <p className="section-caption">Hasta la entrada del inserto: {mountMetadata(v).bodyScrews.gripLength.toFixed(1)} mm. Hasta el fondo ciego: {mountMetadata(v).bodyScrews.lengthToPocketBottom.toFixed(1)} mm, sin contar arandela. Elegí el largo con la rosca necesaria y margen para que la punta no toque el fondo. Herrajes comerciales cotizados aparte.</p>
      </Section>
      <p className="fine-note">Ensayar ajuste y carga con las piezas impresas antes de instalar. Los anclajes de pared se eligen según el muro.</p>
    </>}</>}
    {component==="seals"&&<Section title="Juntas imprimibles"><FieldGroup>{n("sealThickness","Espesor de junta flexible",0,1.5,.1)}</FieldGroup><p className="section-caption">0 desactiva las juntas. Se exportan {v.segments===1?"enteras":"por sectores"} y como material flexible separado, con tarifa y densidad propias en Producción. La junta no certifica estanquidad.</p></Section>}
    <Section title="Vista del componente" defaultOpen={false}><FieldGroup><Field><FieldLabel htmlFor="lightbox-color">Color</FieldLabel><input id="lightbox-color" type="color" value={p.colors[component]} onChange={e=>onChange({...p,colors:{...p.colors,[component]:e.target.value}})}/></Field>
      <SwitchControl label="Visible en el conjunto" value={!p.hidden.includes(component)} onChange={visible=>onChange({...p,hidden:visible?p.hidden.filter(v=>v!==component):[...new Set([...p.hidden,component])]})}/>
    </FieldGroup></Section>
    <Button variant="ghost" onClick={()=>onChange({...p,lightbox:{...DEFAULT_LIGHTBOX}})}><RotateCcw data-icon="inline-start"/>Restaurar medidas de banderola</Button>
  </div>;
}

function LightboxMountDiagram({style}:{style:LightboxParameters["mountStyle"]}){
  return <svg viewBox="0 0 260 112" className="w-full mt-4" role="img" aria-label={`Esquema del soporte ${LIGHTBOX_MOUNT_STYLES[style].label}`}>
    <path d="M229 7 Q172 53 214 105" fill="none" stroke="currentColor" strokeWidth="10" opacity=".18"/>
    <path d="M31 26 V88" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round"/>
    <path d={style==="arch"?"M35 28 Q106 70 193 36 L193 80 Q106 52 35 92 Z":style==="classic"?"M35 48 H193 V66 L35 83 Z":"M35 48 H193 V67 H35 Z"} fill="currentColor"/>
    <path d="M206 25 Q185 53 199 86" fill="none" stroke="var(--primary)" strokeWidth="7"/>
    <path d="M222 41 L201 41 M222 74 L198 74" fill="none" stroke="currentColor" strokeWidth="2"/>
    <path d="M222 36 V46 M222 69 V79" stroke="currentColor" strokeWidth="3"/>
    <text x="24" y="106" fill="currentColor" fontSize="10">Pared</text>
    <text x="239" y="106" textAnchor="end" fill="currentColor" fontSize="10">Cuerpo</text>
  </svg>;
}


function LightboxSideDiagram({params:p}:{params:LightboxParameters}){
  const profile=lightboxSideProfile(p),scale=228/p.depth;
  const outline=[[16,72],...profile.levels.map(l=>[16+l.z*scale,72-l.offset*3]),[244,72],[244,88],[16,88]];
  return <>
    <svg viewBox="0 0 260 110" className="w-full mt-4" role="img" aria-label={`Esquema del lateral ${LIGHTBOX_SIDE_PROFILES[p.sideProfile]}`}>
      <rect x="16" y="26" width={p.rimOverlap*scale} height="64" rx="3" fill="currentColor" opacity=".08"/>
      <rect x={244-p.rimOverlap*scale} y="26" width={p.rimOverlap*scale} height="64" rx="3" fill="currentColor" opacity=".08"/>
      <polygon points={outline.map(p=>p.join(",")).join(" ")} fill="var(--primary)" fillOpacity=".16" stroke="currentColor" strokeWidth="1"/>
      <text x="16" y="103" fill="currentColor" fontSize="10">Aro B</text>
      <text x="244" y="103" textAnchor="end" fill="currentColor" fontSize="10">Aro A</text>
    </svg>
    {p.sideProfile!=="smooth"&&<p className="section-caption">Franja del perfil: {profile.span.toFixed(1)} mm · relieve resultante: {profile.peak.toFixed(1)} mm. Diámetro máximo del lateral: {(p.diameter+profile.peak*2).toFixed(1)} mm. Los extremos y las pendientes se adaptan al espacio disponible.</p>}
  </>;
}
