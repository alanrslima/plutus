import { TransactionType } from '../../domain/entities/Category'

interface DefaultCategory {
  name: string
  type: TransactionType
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // ── Despesas ──────────────────────────────────────────────
  { name: 'Alimentação',              type: 'expense' },
  { name: 'Supermercado',             type: 'expense' },
  { name: 'Restaurante e Delivery',   type: 'expense' },
  { name: 'Moradia',                  type: 'expense' },
  { name: 'Transporte',               type: 'expense' },
  { name: 'Combustível',              type: 'expense' },
  { name: 'Saúde',                    type: 'expense' },
  { name: 'Farmácia',                 type: 'expense' },
  { name: 'Educação',                 type: 'expense' },
  { name: 'Lazer e Entretenimento',   type: 'expense' },
  { name: 'Assinaturas e Streaming',  type: 'expense' },
  { name: 'Roupas e Acessórios',      type: 'expense' },
  { name: 'Telefone e Internet',      type: 'expense' },
  { name: 'Energia Elétrica',         type: 'expense' },
  { name: 'Água e Saneamento',        type: 'expense' },
  { name: 'Academia e Esportes',      type: 'expense' },
  { name: 'Pet',                      type: 'expense' },
  { name: 'Viagem',                   type: 'expense' },
  { name: 'Impostos e Taxas',         type: 'expense' },
  { name: 'Outros (Despesa)',         type: 'expense' },

  // ── Receitas ──────────────────────────────────────────────
  { name: 'Salário',                  type: 'income' },
  { name: 'Freelance',                type: 'income' },
  { name: 'Investimentos',            type: 'income' },
  { name: 'Aluguel Recebido',         type: 'income' },
  { name: 'Dividendos',               type: 'income' },
  { name: 'Reembolso',                type: 'income' },
  { name: 'Presente',                 type: 'income' },
  { name: 'Outros (Receita)',         type: 'income' },
]
