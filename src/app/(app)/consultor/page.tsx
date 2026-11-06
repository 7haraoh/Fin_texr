import { ChatPanel } from "@/components/chat";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Consultor IA" };

export default function Consultor() {
  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col lg:h-[calc(100dvh-10rem)]">
      <PageHeader title="Consultor financeiro IA" subtitle="Analisa sua realidade antes de responder: situação, impacto, riscos, consequências e recomendação. Cálculos feitos pelo sistema, não estimados pela IA." />
      <div className="card min-h-0 flex-1 p-4"><ChatPanel /></div>
    </div>
  );
}
