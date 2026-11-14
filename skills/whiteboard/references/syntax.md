# Diagram syntax

Short working examples of each diagram type. Every Mermaid example here is rendered in this
repository's tests. Full documentation: https://mermaid.js.org/intro/,
https://d2lang.com/tour/intro, https://plantuml.com/.

## Mermaid

### Flowchart / architecture

```mermaid
flowchart LR
  user([Customer]) -->|HTTPS| web[Web app]
  subgraph platform [Shop platform]
    web -->|REST| api[Orders API]
    api -->|SQL| db[(Postgres)]
    api -->|publishes OrderPlaced| bus{{Event bus}}
  end
  bus --> mail[Email worker]
```

Directions: `TD` (top-down), `LR`, `BT`, `RL`. Shapes: `[box]`, `(rounded)`, `([stadium])`,
`[(database)]`, `{decision}`, `{{hexagon}}`, `((circle))`. Edges: `-->`, `-.->` (dotted),
`==>` (thick), `-->|label|`.

### Sequence

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant A as API
  participant P as Payments
  U->>A: POST /checkout
  A->>P: charge(card, total)
  alt card accepted
    P-->>A: ok
    A-->>U: 201 Created
  else declined
    P-->>A: declined
    A-->>U: 402 Payment Required
  end
  Note over A,P: retried up to 3 times
```

Arrows: `->>` call, `-->>` reply, `-x` failure, `-)` async. Blocks: `alt/else`, `opt`,
`loop`, `par/and`, `critical`, `break`.

### Class

```mermaid
classDiagram
  class Order {
    +String id
    +Money total
    +place() void
  }
  class LineItem {
    +int quantity
  }
  Order "1" *-- "1..*" LineItem : contains
  Order --> Customer : placed by
  PaymentMethod <|.. Card
```

Relations: `<|--` inheritance, `<|..` realization, `*--` composition, `o--` aggregation,
`-->` association, `..>` dependency.

### State

```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Submitted : submit()
  Submitted --> Approved : approve
  Submitted --> Draft : request changes
  Approved --> [*]
```

### ER

```mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "appears in"
  ORDER {
    uuid id PK
    uuid customer_id FK
    timestamp placed_at
  }
```

Cardinality: `||` exactly one, `|o` zero or one, `}|` one or more, `}o` zero or more.

### Gantt

```mermaid
gantt
  title Release plan
  dateFormat YYYY-MM-DD
  section Build
    API changes   :a1, 2026-01-05, 10d
    UI            :after a1, 7d
  section Ship
    Beta          :milestone, 2026-01-26, 0d
```

### Mind map

```mermaid
mindmap
  root((Whiteboard))
    Languages
      Mermaid
      D2
      PlantUML
    Outputs
      SVG
      PNG
```

## D2

Good for large architecture diagrams: containers nest, layout is automatic.

```d2
direction: right
customer: Customer {shape: person}
platform: Shop platform {
  web: Web app
  api: Orders API
  db: Postgres {shape: cylinder}
  web -> api: REST
  api -> db: SQL
}
customer -> platform.web: HTTPS
```

## PlantUML

Wrap every diagram in `@startuml` / `@enduml`.

```plantuml
@startuml
actor User
participant API
database DB
User -> API: GET /orders
API -> DB: SELECT
DB --> API: rows
API --> User: 200 OK
@enduml
```

## Common errors and fixes

| Error | Fix |
|---|---|
| `Parse error on line N` with `(`, `)`, `[`, `]`, `{`, `}`, `:` or `"` in a label | Quote the label: `A["calls f(x)"]`. In sequence messages, avoid `;` and `#`. |
| `No diagram type detected` | The first line must be the diagram type (`flowchart TD`, `sequenceDiagram`, …), with nothing before it. |
| A node named `end` breaks a flowchart | `end` is a keyword: use `End` or `finish[end]`. |
| `-->` inside a sequence diagram | Sequence arrows are `->>` and `-->>`. |
| Class member with generics fails | Use `~`: `List~Order~ items`. |
| ER attribute fails | Each attribute is `type name` with an optional `PK`, `FK` or `UK`; no spaces in either. |
| Subgraph titles with spaces | `subgraph id [Title with spaces]`. |
| D2 `err: ... unexpected text` | Quote keys or labels with special characters: `"user (admin)"`. |
| PlantUML `Syntax Error?` | Check `@startuml`/`@enduml` and arrow spelling (`->`, `-->`). |
