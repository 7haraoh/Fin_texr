# Finance OS — Inteligência Financeira Pessoal

Aplicativo web de gestão financeira pessoal com um consultor de IA. Ele não serve só para registrar gastos: lê sua realidade financeira, identifica riscos, planeja metas e avalia decisões antes de você tomá-las.

## O que já funciona (v0.1)

| Módulo | Destaques |
|---|---|
| **Minha saúde financeira** (dashboard) | 10 indicadores, pontuação de 0 a 100 (Excelente · Saudável · Atenção · Risco · Crítico) calculada a partir de economia, dívidas, reserva, liquidez, comprometimento e metas; 6 gráficos; alertas e oportunidades priorizados |
| **Perfil financeiro** | Renda (bruta/líquida, frequência, estabilidade, reajustes), patrimônio, obrigações, cartões, estilo de vida e comportamento — tudo preenchido aos poucos |
| **Despesas** | Lançamentos com categoria, forma de pagamento, cartão, parcelas, essencial/não essencial, recorrência e observações; categorias personalizadas; padrões por categoria |
| **Orçamento** | Distribuição personalizada (sem 50/30/20 fixo) entre 7 finalidades; consumido × disponível; limites por categoria; recalcula sozinho |
| **Metas** | Progresso, aporte necessário, projeção de conclusão, viabilidade frente à capacidade de economia e sugestões de ajuste |
| **Simulador de compras** | 4 vereditos com motivos e alternativas; comparação entre à vista e parcelado (juros, desconto e custo de oportunidade) |
| **Reserva e proteção** | Custo essencial, metas de 3/6/12 meses, cobertura e simulação de 5 situações adversas |
| **Cartões e dívidas** | Faturas por ciclo de fechamento, limite usado com parcelas futuras, atrasos e comprometimento da renda nos próximos 12 meses |
| **Projeções** | 6 meses, 1, 3 e 5 anos nos cenários conservador, realista e otimista, com premissas explícitas |
| **Relatório mensal** | O que foi bem, o que precisa melhorar, riscos, oportunidades e prioridades; exportável em PDF (via impressão) |
| **Consultor IA** | Chat disponível em qualquer tela, com resposta em tempo real (streaming); usa as ferramentas de cálculo do backend e segue as diretrizes de prudência |
| **Dados e privacidade** | Exportação em Excel/JSON, histórico de alterações, exclusão permanente da conta e política de privacidade |

## Arquitetura

```
src/
  lib/finance/     ← motor financeiro DETERMINÍSTICO (TypeScript puro, testado)
    snapshot.ts      indicadores: patrimônio ≠ saldo disponível ≠ renda
    cards.ts         faturas: compra = consumo na data; fatura = obrigação de caixa
    health.ts  reserve.ts  budget.ts  goals.ts  purchase.ts  insights.ts  projection.ts
  lib/ai/          ← camada de IA (separada das regras de negócio)
    prompt.ts        diretrizes do consultor
    context.ts       resumo agregado mínimo enviado ao modelo
    tools.ts         ferramentas que a IA chama → executadas pelo motor determinístico
  lib/validation/  ← validação zod de toda entrada
  app/             ← páginas (Next.js App Router), server actions e rotas de API
supabase/migrations/0001_init.sql  ← esquema, RLS, auditoria e exclusão de conta
```

**Princípios contábeis adotados**
- A renda recorrente vem do Perfil. O lançamento "Receita extra" serve apenas para rendas eventuais, evitando contagem dupla do salário.
- A compra no cartão é despesa na data da compra (o valor total). As parcelas entram nas faturas futuras. O "Pagamento de fatura" só reduz a dívida do cartão e nunca vira uma segunda despesa.
- As parcelas de empréstimos e financiamentos vêm de *Obrigações* e entram automaticamente nos cálculos. Não as lance como despesa.
- Aportes na categoria *Financeiro › Investimentos* contam como poupança, não como consumo.
- A reserva de emergência (ativos marcados) conta como liquidez, mas nunca como dinheiro livre para gastar.
- Datas no fuso de Brasília (`America/Sao_Paulo`), valores em R$ e formato dd/mm/aaaa.

## Segurança e privacidade
- Autenticação do Supabase Auth (e-mail e senha; mínimo de 10 caracteres no cadastro).
- **Row Level Security** em todas as tabelas: cada usuário só lê e altera os próprios registros. Gatilhos impedem referenciar a categoria ou o cartão de outro usuário.
- Criptografia em trânsito (HTTPS, com cabeçalho HSTS) e em repouso (disco do Supabase criptografado em AES-256).
- Histórico de alterações (`audit_log`) gravado por gatilho, somente leitura para o dono.
- `delete_my_account()` remove o usuário e todos os dados em cascata, inclusive o histórico.
- Nenhuma senha bancária ou número de cartão é solicitado. A IA recebe só um resumo agregado, sem e-mail, sem instituições e sem observações livres.
- Limite de uso do consultor: 8 mensagens por minuto e 150 por dia por usuário.

## Como rodar

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo recomendada).
2. No **SQL Editor**, execute o conteúdo de `supabase/migrations/0001_init.sql` (ou rode `supabase db push` com a CLI).
3. Em **Authentication › URL Configuration**, adicione `http://localhost:3000/auth/callback` (e a URL de produção) às Redirect URLs.

### 2. Variáveis de ambiente
```bash
cp .env.example .env.local
# preencha NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e ANTHROPIC_API_KEY
```
A chave da Anthropic fica apenas no servidor. Sem ela, todo o app funciona, exceto o chat do consultor.

### 3. Executar
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes do motor financeiro e das ferramentas da IA
npm run build      # build de produção
```

Para publicar, a Vercel funciona sem configuração extra: importe o repositório e defina as mesmas variáveis de ambiente.

## Consultor IA
- Modelo padrão: `claude-opus-5-5` (pode ser trocado por `ANTHROPIC_MODEL`), com esforço `medium` e fallback automático do servidor em caso de recusa.
- O consultor recebe uma *fotografia financeira* calculada pelo backend e pode chamar 5 ferramentas determinísticas: `simular_compra`, `planejar_objetivo`, `simular_financiamento`, `projetar_patrimonio` e `testar_cenarios_adversos`.
- As respostas sobre decisões seguem a estrutura: situação atual → impacto → riscos → curto e longo prazo → recomendação.
- Ele distingue orientação educacional de recomendação profissional e indica um profissional habilitado quando necessário.

## Próximos passos sugeridos
- Integração bancária via Open Finance (provedor autorizado).
- Notificações por e-mail ou push dos alertas de prioridade alta.
- Relatório mensal comentado pela IA, gerado automaticamente.
- Importação de extratos (OFX/CSV).
- Edição das premissas de projeção pelo usuário.
