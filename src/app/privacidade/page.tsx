import Link from "next/link";
export const metadata = { title: "Política de privacidade" };

export default function Privacidade() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed">
      <Link href="/" className="text-xs text-accent">← Voltar</Link>
      <h1 className="mt-4 text-2xl font-semibold">Política de privacidade</h1>
      <p className="mt-2 text-muted">Resumo claro de como o Finance OS trata seus dados financeiros pessoais, em linha com a LGPD (Lei nº 13.709/2018).</p>

      <h2 className="mt-8 text-base font-semibold">1. Quais dados coletamos</h2>
      <p className="mt-2">Apenas o que você cadastra: e-mail de acesso, renda, patrimônio, obrigações, cartões (nome, limite e datas — nunca o número), despesas, metas, orçamento, preferências de estilo de vida e o histórico de conversas com o consultor.</p>
      <h2 className="mt-6 text-base font-semibold">2. O que nunca pedimos</h2>
      <p className="mt-2">Senhas bancárias, credenciais de acesso a bancos, números completos de cartão ou códigos de segurança. Uma futura integração bancária só ocorrerá via Open Finance, com seu consentimento explícito.</p>
      <h2 className="mt-6 text-base font-semibold">3. Como protegemos</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Criptografia em trânsito (HTTPS/TLS) e em repouso (banco de dados criptografado pelo provedor).</li>
        <li>Isolamento por usuário com Row Level Security: cada registro só pode ser lido e alterado pelo próprio dono.</li>
        <li>Histórico de alterações dos seus lançamentos, visível apenas para você.</li>
      </ul>
      <h2 className="mt-6 text-base font-semibold">4. Uso de inteligência artificial</h2>
      <p className="mt-2">Quando você conversa com o consultor, enviamos ao provedor de IA (Anthropic) apenas um resumo agregado e calculado da sua situação financeira e as mensagens da conversa — sem e-mail, sem nomes de instituições e sem observações livres. Os cálculos são feitos pelo nosso servidor, não pela IA. O provedor não utiliza dados da API para treinar modelos, conforme seus termos comerciais.</p>
      <h2 className="mt-6 text-base font-semibold">5. Compartilhamento</h2>
      <p className="mt-2">Não vendemos nem compartilhamos seus dados financeiros com terceiros sem sua autorização, exceto os operadores estritamente necessários ao funcionamento (hospedagem, banco de dados e IA).</p>
      <h2 className="mt-6 text-base font-semibold">6. Seus direitos</h2>
      <p className="mt-2">Você pode, a qualquer momento, em <em>Dados e privacidade</em>: exportar todos os seus dados (JSON e Excel), corrigir qualquer informação e excluir permanentemente sua conta e todos os dados associados.</p>
      <h2 className="mt-6 text-base font-semibold">7. Natureza das orientações</h2>
      <p className="mt-2">O Finance OS oferece educação e planejamento financeiro. As análises não constituem recomendação profissional de investimento, tributação ou crédito; para essas decisões, consulte um profissional habilitado.</p>
    </div>
  );
}
