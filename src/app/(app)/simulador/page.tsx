import { PageHeader } from "@/components/ui";
import { Simulator } from "@/components/simulator";
export const metadata = { title: "Simulador de compras" };
export default function Page() {
  return (
    <>
      <PageHeader title="Simulador de compras e decisões" subtitle="Avalie antes de comprar. Para perguntas abertas, use o consultor IA." />
      <Simulator />
    </>
  );
}
