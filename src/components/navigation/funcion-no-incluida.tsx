import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function FuncionNoIncluida() {
  return (
    <div className="p-6 w-full">
      <Alert>
        <AlertTitle>Función no incluida en tu plan</AlertTitle>
        <AlertDescription>
          Podés continuar con las funciones disponibles desde el menú de Grafo.
        </AlertDescription>
      </Alert>
    </div>
  );
}
