# Finance Copilot — Documento de Especificação e Plano de Implementação

> **Premissa central:** o Copilot não é um relatório interativo. É um agente que lê o comportamento financeiro do usuário, formula diagnósticos com linguagem direta e oferece ações que o usuário pode executar com um clique. A diferença entre um dashboard e o Copilot é a diferença entre um extrato bancário e um consultor financeiro.

---

## 1. Visão do Produto

### O que é

Um assistente financeiro persistente que roda análises periódicas sobre os dados do usuário (transações, contas, categorias, metas) e produz **insights acionáveis** — não gráficos, não tabelas, mas frases diretas com um botão ao lado.

### O que NÃO é

- Não é um chatbot de perguntas e respostas genéricas
- Não é um re-empacotamento dos relatórios já existentes
- Não é uma funcionalidade de exibição — é de decisão assistida

### Exemplos de saída esperada

```
💡 Você gastou R$ 1.240 em "Restaurante e Delivery" em março — 38% acima da sua
   média dos últimos 3 meses (R$ 900). Isso equivale a 12% da sua renda do mês.
   [Criar meta para essa categoria]

⚠️  Detectamos 4 cobranças recorrentes que somam R$ 189/mês:
    Netflix R$ 55, Spotify R$ 22, Adobe R$ 67, iCloud R$ 45.
    Você não movimentou a Adobe nos últimos 60 dias.
    [Marcar Adobe como dispensável]

🎯 Com base no seu histórico, você conseguiria guardar R$ 420/mês
   reduzindo alimentação para a sua própria média de 6 meses atrás.
   [Criar meta de economia]
```

---

## 2. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│                                                             │
│  CopilotPage                                                │
│  ├── InsightCard (diagnóstico + botão de ação)              │
│  ├── ActionPanel (metas, orçamentos criados via Copilot)    │
│  └── AnalyzeButton (dispara nova análise manual)            │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│                        BACKEND                              │
│                                                             │
│  POST /copilot/analyze   ← dispara análise, retorna stream  │
│  GET  /copilot/insights  ← insights persistidos             │
│  POST /copilot/action    ← executa ação de um insight       │
│                                                             │
│  CopilotUseCase                                             │
│  ├── FinancialContextBuilder  ← monta snapshot dos dados    │
│  ├── InsightEngine (IAIProvider)  ← chama a LLM             │
│  ├── InsightParser            ← estrutura a resposta JSON   │
│  └── ActionExecutor           ← cria meta / orçamento / tag │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Novos Modelos de Dados

### 3.1 `Goal` (Metas)

```prisma
model Goal {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  categoryId  String?  @map("category_id")
  title       String
  targetAmount Decimal @db.Decimal(15,2) @map("target_amount")
  currentAmount Decimal @default(0) @db.Decimal(15,2) @map("current_amount")
  deadline    DateTime?
  type        GoalType  // spending_limit | savings_target
  status      GoalStatus @default(active) // active | achieved | cancelled
  createdAt   DateTime @default(now()) @map("created_at")
  source      String?  // "manual" | "copilot"

  user     User      @relation(...)
  category Category? @relation(...)

  @@map("goals")
}

enum GoalType   { spending_limit savings_target }
enum GoalStatus { active achieved cancelled }
```

### 3.2 `CopilotInsight`

```prisma
model CopilotInsight {
  id          String        @id @default(uuid())
  userId      String        @map("user_id")
  type        InsightType
  title       String
  body        String        // texto completo do insight
  data        Json?         // dados estruturados que sustentam o insight
  actionType  ActionType?   @map("action_type")
  actionPayload Json?       @map("action_payload") // parâmetros pré-preenchidos
  actionTaken Boolean       @default(false) @map("action_taken")
  dismissed   Boolean       @default(false)
  createdAt   DateTime      @default(now()) @map("created_at")
  expiresAt   DateTime?     @map("expires_at")

  user User @relation(...)

  @@map("copilot_insights")
}

enum InsightType {
  overspending        // gasto acima da média
  recurring_detected  // assinatura/recorrente identificada
  savings_opportunity // oportunidade de economia
  positive_trend      // comportamento positivo (reforço)
  anomaly             // transação fora do padrão
  budget_at_risk      // orçamento prestes a estourar
}

enum ActionType {
  create_goal
  create_budget
  tag_subscription
  dismiss_insight
}
```

### Por que persistir insights?

- Evita re-chamar a LLM a cada visita (custo e latência)
- Permite o usuário ver histórico de recomendações
- Permite medir taxa de adoção das sugestões
- Insights têm `expiresAt` — após 7 dias são re-gerados se o usuário pedir nova análise

---

## 4. O Contexto Financeiro (input da LLM)

A qualidade do insight depende diretamente da qualidade do contexto enviado. O `FinancialContextBuilder` monta um snapshot estruturado antes de chamar a LLM:

```typescript
interface FinancialContext {
  // Período analisado
  period: { current: string; previous: string; sixMonthAvg: string }

  // Resumo de receita/despesa
  summary: {
    currentMonth: { income: number; expense: number; balance: number }
    previousMonth: { income: number; expense: number; balance: number }
    sixMonthAvgExpense: number
    sixMonthAvgIncome: number
  }

  // Gastos por categoria com comparação
  categoryBreakdown: {
    categoryName: string
    currentMonth: number
    previousMonth: number
    sixMonthAvg: number
    percentOfIncome: number
    trend: 'up' | 'down' | 'stable'
  }[]

  // Transações recorrentes detectadas heuristicamente
  // (mesmo valor ± 5%, mesma descrição, intervalo ~30 dias)
  recurringExpenses: {
    description: string
    estimatedMonthlyAmount: number
    lastSeenDaysAgo: number
    occurrences: number
  }[]

  // Contas e saldo atual
  accounts: { name: string; balance: number }[]

  // Metas já existentes (para não duplicar sugestões)
  existingGoals: { title: string; type: string; targetAmount: number }[]
}
```

**Regras de construção:**
- Usa dados dos últimos 6 meses + mês atual
- Recorrentes: detectados por heurística no repositório (sem LLM)
- Contexto é serializado em JSON compacto para minimizar tokens
- Valores monetários formatados como number, não string (ex: `1240.50` não `"R$ 1.240,50"`)

---

## 5. O Prompt do Copilot

### System prompt

```
Você é o Finance Copilot do Plutos, um assistente financeiro pessoal.
Sua função é analisar dados financeiros reais de um usuário brasileiro e retornar
EXATAMENTE um array JSON com 3 a 6 insights acionáveis.

Regras obrigatórias:
1. Responda APENAS com JSON válido. Nenhum texto fora do array.
2. Cada insight deve ter: type, title, body, actionType, actionPayload
3. O campo "body" deve ser direto, em primeira pessoa do assistente, em português BR.
   Mencione valores específicos. Evite linguagem vaga.
4. Priorize por impacto financeiro real (maior valor em jogo primeiro).
5. Inclua pelo menos 1 insight positivo se o comportamento do mês for bom.
6. NÃO invente dados. Use apenas os números do contexto fornecido.
7. actionPayload deve conter os campos prontos para criar o objeto (pre-fill para o usuário).

Tipos de ação disponíveis: create_goal, create_budget, tag_subscription, null (só informativo)

Schema de saída:
[
  {
    "type": "overspending" | "recurring_detected" | "savings_opportunity" | "positive_trend" | "anomaly" | "budget_at_risk",
    "title": "string curta (máx 60 chars)",
    "body": "string descritiva (2-4 frases)",
    "actionType": "create_goal" | "create_budget" | "tag_subscription" | null,
    "actionPayload": { ... } | null
  }
]
```

### User prompt

```
Contexto financeiro do usuário (dados dos últimos 6 meses + mês atual):
<FINANCIAL_CONTEXT_JSON>

Gere os insights agora.
```

---

## 6. ActionExecutor — O que cada ação faz

| `actionType` | O que acontece no backend | Payload esperado |
|---|---|---|
| `create_goal` | Cria registro na tabela `Goal` com `source: "copilot"` | `{ title, targetAmount, type, categoryId?, deadline? }` |
| `create_budget` | Cria meta de `spending_limit` para uma categoria no mês | `{ categoryId, targetAmount, title }` |
| `tag_subscription` | Adiciona tag/nota na transação recorrente e marca na UI | `{ description, estimatedAmount }` (informativo por ora) |

A execução acontece em `POST /copilot/action` com body:
```json
{
  "insightId": "uuid",
  "actionType": "create_goal",
  "payload": { ... }
}
```

O endpoint marca `actionTaken = true` no insight e executa a ação correspondente.

---

## 7. Detecção Heurística de Recorrentes (sem LLM)

Antes de chamar a LLM, o `FinancialContextBuilder` roda uma detecção local de transações recorrentes para incluir no contexto. Isso evita depender da LLM para detectar o óbvio.

**Algoritmo:**
```
Para cada par de transações do mesmo usuário:
  - Mesma descrição (ou distância Levenshtein < 20%)
  - Valor dentro de ±5%
  - Intervalo entre datas: 25-35 dias (mensal) ou 6-8 dias (semanal)
  - Mínimo 2 ocorrências nos últimos 90 dias
→ Marca como recorrente
```

Implementado diretamente em SQL/Prisma no `PrismaTransactionRepository`, sem dependência de biblioteca externa.

---

## 8. UX — Página do Copilot

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Finance Copilot                    [Analisar agora] │
│  Última análise: há 2 horas                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⚠️  Alimentação 38% acima da média           │   │
│  │                                             │   │
│  │  Você gastou R$ 1.240 em restaurantes em    │   │
│  │  março — sua média dos últimos 3 meses é    │   │
│  │  R$ 900. Isso representa 12% da sua renda.  │   │
│  │                                             │   │
│  │  [Criar limite de R$ 900]    [Ignorar]      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 💡 4 assinaturas somam R$ 189/mês            │   │
│  │  ...                                        │   │
│  │  [Ver detalhes]              [Ignorar]      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Estados da página

1. **Sem dados suficientes** — menos de 30 dias de transações → mensagem orientando o usuário a importar mais dados
2. **Analisando** — spinner com streaming do texto gerado (para não parecer travado)
3. **Insights ativos** — cards com ações disponíveis
4. **Todos ignorados/executados** — empty state com botão para nova análise
5. **Erro de API** — mensagem clara sem expor detalhes técnicos

### Feedback de ação

Quando o usuário clica em uma ação:
- Modal de confirmação com os campos pré-preenchidos editáveis (não um clique cego)
- Após confirmar: card colapsa com animação de "✓ Feito"
- Toast com link para o item criado (ex: "Meta criada → ver em Metas")

---

## 9. Considerações Técnicas

### 9.1 Custo e rate limiting

- A análise chama a LLM com um contexto de ~1.500–3.000 tokens
- Resposta esperada: ~600–1.200 tokens
- Custo estimado com Claude Haiku: ~$0.002 por análise
- **Throttle:** máximo 1 análise por hora por usuário (verificado no backend)
- Insights são cacheados por 7 dias — a LLM só é chamada quando o usuário pede nova análise explicitamente ou os insights expiraram

### 9.2 Streaming

A resposta da LLM pode levar 3–8 segundos. Para boa UX:
- O endpoint `/copilot/analyze` retorna **Server-Sent Events (SSE)**
- O frontend exibe o texto sendo escrito em tempo real
- Ao completar o stream, o backend persiste os insights e o frontend re-busca `/copilot/insights`

### 9.3 Dados mínimos necessários

A análise só faz sentido com:
- Mínimo 20 transações no histórico
- Mínimo 2 meses de dados
- Pelo menos 1 categoria usada

Se os dados forem insuficientes, o endpoint retorna `{ insufficient_data: true, reason: "..." }` em vez de chamar a LLM.

### 9.4 Privacidade

- Nenhum dado pessoal identificável (nome, CPF, email) é enviado para a LLM
- O contexto contém apenas valores, nomes de categorias e descrições de transações
- Descrições longas são truncadas a 50 caracteres antes de enviar

### 9.5 Modelo recomendado

Para o Copilot, usar **Claude Sonnet** (não Haiku) — a qualidade do raciocínio sobre padrões financeiros é notavelmente melhor. O custo adicional (~5-10x Haiku) é justificável dado que a análise é esporádica (não por transação).

---

## 10. Plano de Ação — Implementação em Fases

### Fase 0 — Fundação de dados (sem LLM)
> Objetivo: ter as estruturas necessárias e a detecção heurística funcionando.

- [ ] **0.1** Prisma migration: tabelas `Goal` e `CopilotInsight`
- [ ] **0.2** Domain entities: `Goal.ts`, `CopilotInsight.ts`
- [ ] **0.3** Repository interfaces: `IGoalRepository`, `ICopilotInsightRepository`
- [ ] **0.4** Implementações Prisma: `PrismaGoalRepository`, `PrismaCopilotInsightRepository`
- [ ] **0.5** `RecurringDetector`: query SQL que identifica transações recorrentes por heurística (descrição + valor + intervalo)
- [ ] **0.6** `FinancialContextBuilder`: serviço que agrega dados dos últimos 6 meses em `FinancialContext`
- [ ] **0.7** Testes manuais do contexto gerado (logar o JSON antes de enviar para a LLM)

**Entregável:** endpoint `GET /copilot/context` que retorna o JSON de contexto — útil para debug e validar que os dados estão corretos antes de introduzir a LLM.

---

### Fase 1 — Motor de insights (LLM)
> Objetivo: gerar insights reais e persistir.

- [ ] **1.1** `buildCopilotPrompt.ts`: system prompt + serialização do contexto para user prompt
- [ ] **1.2** `CopilotInsightParser`: parse e validação do JSON retornado pela LLM (com fallback se JSON mal formado)
- [ ] **1.3** `CopilotUseCase.analyze()`: orquestra Builder → LLM → Parser → persistência
- [ ] **1.4** Throttle: verificar se análise recente existe antes de chamar a LLM
- [ ] **1.5** `CopilotController`: `POST /copilot/analyze` com SSE streaming
- [ ] **1.6** `GET /copilot/insights`: retorna insights ativos (não dismissidos, não expirados)
- [ ] **1.7** Rota no Express e middleware de autenticação
- [ ] **1.8** Testar com dados reais — revisar prompt até os insights serem de qualidade

**Entregável:** chamada via curl/Insomnia que retorna insights JSON coerentes com os dados do banco.

---

### Fase 2 — ActionExecutor
> Objetivo: as ações dos insights criarem objetos reais no sistema.

- [ ] **2.1** `GoalUseCase`: CRUD básico de metas (create, list, update status)
- [ ] **2.2** `GoalsController` + rotas `GET/POST/PATCH /goals`
- [ ] **2.3** `ActionExecutor`: switch por `actionType` → chama o use case correto
- [ ] **2.4** `POST /copilot/action`: valida payload, executa ação, marca `actionTaken = true`
- [ ] **2.5** `PATCH /copilot/insights/:id/dismiss`: marca `dismissed = true`

**Entregável:** conseguir criar uma meta via `POST /copilot/action` e ver ela em `GET /goals`.

---

### Fase 3 — Frontend (página do Copilot)
> Objetivo: UI completa da feature.

- [ ] **3.1** Hook `useCopilotInsights()` — `GET /copilot/insights`
- [ ] **3.2** Hook `useTriggerAnalysis()` — `POST /copilot/analyze` com suporte a SSE
- [ ] **3.3** Hook `useCopilotAction()` — `POST /copilot/action`
- [ ] **3.4** Componente `InsightCard`: ícone por tipo, texto, botão de ação, botão ignorar
- [ ] **3.5** Modal de confirmação de ação com campos editáveis (pré-preenchidos pelo `actionPayload`)
- [ ] **3.6** `CopilotPage`: layout, empty states, estado de loading/streaming
- [ ] **3.7** Rota `/copilot` no `App.tsx` + link no `Sidebar`
- [ ] **3.8** Animação de "done" quando insight é executado/ignorado

**Entregável:** página funcional end-to-end — usuário clica "Analisar", vê insights aparecerem, clica em uma ação, meta é criada.

---

### Fase 4 — Refinamento e Qualidade
> Objetivo: tornar a feature confiável e polida.

- [ ] **4.1** Testar prompt com perfis financeiros variados (usuário endividado, poupador, etc.)
- [ ] **4.2** Adicionar insight de "dados insuficientes" com orientação clara
- [ ] **4.3** Histórico de insights anteriores (accordion colapsável abaixo dos ativos)
- [ ] **4.4** Indicador de progresso nas metas criadas pelo Copilot (cálculo automático via transações)
- [ ] **4.5** Atualização automática de metas: job/hook que calcula `currentAmount` das metas de `spending_limit` com base nas transações do mês
- [ ] **4.6** Badge no sidebar com número de insights novos (não vistos)

---

## 11. Ordem de Prioridade para o MVP

Se o objetivo é ter algo funcional o mais rápido possível:

```
Fase 0 → Fase 1 → Fase 3 (sem modal, ação apenas "ignorar") → Fase 2 → Fase 3 completo
```

Ou seja: primeiro mostrar insights sem ações, depois adicionar as ações. Isso permite validar a qualidade da análise antes de construir a parte mais complexa do executor.

---

## 12. Arquivos a Criar/Modificar

### Backend — novos arquivos
```
backend/prisma/schema.prisma                    ← + Goal, CopilotInsight, enums
backend/src/domain/entities/Goal.ts
backend/src/domain/entities/CopilotInsight.ts
backend/src/domain/repositories/IGoalRepository.ts
backend/src/domain/repositories/ICopilotInsightRepository.ts
backend/src/infra/database/repositories/PrismaGoalRepository.ts
backend/src/infra/database/repositories/PrismaCopilotInsightRepository.ts
backend/src/application/services/FinancialContextBuilder.ts
backend/src/application/services/RecurringDetector.ts
backend/src/application/services/ActionExecutor.ts
backend/src/application/use-cases/copilot/CopilotUseCase.ts
backend/src/application/use-cases/goals/GoalUseCase.ts
backend/src/infra/ai/buildCopilotPrompt.ts
backend/src/infra/ai/parseCopilotResponse.ts
backend/src/interfaces/controllers/CopilotController.ts
backend/src/interfaces/controllers/GoalsController.ts
backend/src/interfaces/routes/copilot.routes.ts
backend/src/interfaces/routes/goals.routes.ts
```

### Backend — arquivos modificados
```
backend/src/server.ts                           ← montar novas rotas
```

### Frontend — novos arquivos
```
frontend/src/pages/copilot/CopilotPage.tsx
frontend/src/pages/copilot/InsightCard.tsx
frontend/src/pages/copilot/ActionConfirmModal.tsx
frontend/src/hooks/useCopilot.ts
frontend/src/hooks/useGoals.ts
frontend/src/types/index.ts                     ← + Goal, CopilotInsight
```

### Frontend — arquivos modificados
```
frontend/src/App.tsx                            ← + rota /copilot
frontend/src/components/layout/Sidebar.tsx      ← + link + badge
```

---

## 13. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| LLM retorna JSON malformado | Média | Parser com fallback + retry uma vez com instrução mais rígida |
| Insights irrelevantes ou genéricos | Alta inicialmente | Iterar no prompt com dados reais; adicionar exemplos no system prompt (few-shot) |
| Custo inesperado com chamadas excessivas | Baixa | Throttle por hora + expiração de 7 dias |
| Usuário com poucos dados gera insights fracos | Alta | Gate de dados mínimos antes de chamar a LLM |
| Ação cria objeto duplicado | Baixa | Verificar se meta com mesma categoria/título já existe antes de criar |
| SSE não funciona atrás de proxy/Nginx | Média | Testar com `proxy_buffering off` no Nginx; ter fallback polling |

---

## 14. Métricas de Sucesso do MVP

- **Taxa de adoção de ação:** % de insights que resultam em ação (meta: >30%)
- **Taxa de dismissal:** % de insights ignorados sem ação (sinal de qualidade)
- **Qualidade percebida:** os valores mencionados no insight são corretos e relevantes?
- **Latência da análise:** tempo total do clique "Analisar" até ver o primeiro insight (meta: <5s com streaming)
