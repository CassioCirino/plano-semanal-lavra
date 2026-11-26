# Plano Semanal de Lavra

App web (PWA) para acompanhar o plano semanal de lavra em um Gantt simples, com apontamento rápido do andamento, semáforo de atraso e adiantamento, alertas e indicadores de aderência e cumprimento. Foi desenvolvido para o desafio SENAI "Automatização do Plano Semanal" (BEMISA).

Funciona no celular e no PC, pode ser instalado como aplicativo e continua funcionando sem sinal na mina: os apontamentos ficam salvos no aparelho e são enviados quando a conexão volta.

## Telas

| Tela | O que mostra |
| --- | --- |
| **Gantt** | A semana em linha do tempo (PC) ou por dia (celular), com o semáforo, a linha de "agora" e filtros por frente. |
| **Hoje** | O que deveria estar rodando agora, os alertas que pedem reação e o que começa ou termina nas próximas 24 h. |
| **Apontar** | Botões para somar o realizado do turno, concluir a atividade e registrar o motivo do desvio. |
| **Aderência** | A aderência em movimentação e em geometria, o cumprimento, o planejado x realizado por dia, o mês x orçamento, o histórico das semanas e os motivos de desvio. |

## Regras de cálculo

- **% previsto**: o tempo decorrido dentro do período planejado (de forma linear).
- **Status**:
  - *Concluída*: 100% realizado.
  - *Programada*: ainda não começou.
  - *Adiantada*: realizado ≥ previsto + 5 p.p.
  - *No prazo*: até 5 p.p. abaixo do previsto.
  - *Crítica*: atrasada e marcada como crítica, ou mais de 20 p.p. abaixo do previsto.
  - *Atrasada*: os demais casos abaixo do previsto.
- **Aderência em movimentação**: Σ mín(realizado, planejado até agora) ÷ Σ planejado até agora, considerando ROM e estéril em toneladas.
- **Aderência em geometria**: a mesma conta, feita sobre o % de avanço físico das atividades de perfuração, desmonte, acessos, bermas etc.
- **Cumprimento**: Σ realizado ÷ Σ planejado até agora (pode passar de 100%).
- **Alertas**:
  - atividades atrasadas ou críticas;
  - ROM planejado no dia acima da capacidade da UTM;
  - ocupação da pilha de estéril.
- **Metas e capacidades**: o orçamento do mês (ROM, estéril e capacidade de movimentação), a capacidade da UTM, a meta de aderência e a pilha de estéril são editados em "⋯ > Metas e capacidades".

## Excel

- **Importar**: aceita .xlsx, .xls ou .csv, com uma linha por atividade. As colunas são reconhecidas pelo nome, como *Atividade*, *Frente*, *Local*, *Equipamento*, *Início planejado*, *Fim planejado*, *Meta*, *Unidade* e *Realizado*. Linhas com ID atualizam a atividade existente.
- **Exportar**: gera uma planilha com o plano da semana, um resumo de aderência e a movimentação por dia. Também é possível exportar todo o histórico.
- **Modelo**: em "⋯ > Baixar planilha modelo".

## Rodar localmente

```bash
npm install
npm run dev
```

## Dados: um plano único para todos

Todo mundo que abre o app usa o mesmo plano. Não há login nem "equipes": o que uma pessoa cadastra ou aponta aparece para as outras.

- O plano fica num documento JSON guardado pela função `/api/blob` da própria Vercel (banco Redis gratuito da Upstash).
- Cada aparelho guarda uma cópia, então o app abre rápido e funciona sem sinal na mina. O que for feito sem sinal sobe quando a conexão volta.
- A sincronização acontece ao abrir o app, a cada 30 segundos e logo depois de cada alteração. As mudanças são juntadas atividade por atividade, e vence a mais recente.
- "Carregar dados de exemplo" e "Remover dados de exemplo" (no menu ⋯) valem para todos.
- Protótipo sem login: quem tiver o endereço pode editar. Para produção, o próximo passo é adicionar login.

### Ligar o banco (uma vez)

O documento fica num banco Redis gratuito da Upstash, ligado ao projeto pela própria Vercel:

1. No painel do projeto na Vercel, abra **Storage** e toque em **Create Database**.
2. Escolha **Upstash for Redis**, aceite o plano gratuito e conecte ao projeto `plano-semanal-lavra`.
3. Refaça o deploy (Deployments > ⋯ > Redeploy).

A Vercel cria as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` sozinha. Para conferir, abra `/api/blob?status=1`.

## Publicar na Vercel

1. Em https://vercel.com/new, importe este repositório. O framework é detectado como **Vite**.
2. Clique em **Deploy**. Cada push na branch principal publica uma nova versão.

## Tecnologia

React 18, TypeScript, Vite, vite-plugin-pwa (instalação e uso offline), SheetJS (Excel) e Upstash Redis via função da Vercel (espaço compartilhado).
