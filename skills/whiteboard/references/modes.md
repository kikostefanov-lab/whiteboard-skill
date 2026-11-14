# Project diagrams

Three requests come up again and again. Each is a short investigation followed by one diagram.
Keep the investigation proportionate: read entry points, manifests and directory structure
before reading individual files.

## Architecture ("draw the architecture", "how is this project put together")

1. Read the README, the package or build manifests (`package.json`, `pyproject.toml`,
   `go.mod`, `Cargo.toml`, `pom.xml`, …) and any `docker-compose`, Kubernetes or
   infrastructure files.
2. List the top-level folders and find the deployable units: apps, services, workers, CLIs,
   libraries, databases, queues, external APIs.
3. Find how they talk: HTTP clients and routes, message topics, database connections,
   shared libraries.
4. Draw one C4-style container diagram: people and external systems outside, the project's
   containers inside a boundary, labelled edges for each interaction. Mermaid `flowchart LR`
   with `subgraph` boundaries works everywhere; D2 is better above about 15 boxes.

Title it `<Project> architecture`.

## Control flow ("draw the flow of X", "what happens when …")

1. Start from the named file, function or feature. With no target, find the main entry
   point (`main`, the server bootstrap, the CLI's command parser, the route the user named).
2. Follow the calls one or two levels deep, noting each hop between modules or services,
   the important branches and where errors are handled.
3. Use a **sequence diagram** when several participants exchange messages (client, API,
   service, database). Use a **flowchart** when the flow is mostly branching inside one
   component.
4. Show error and alternate paths with `alt`/`else` blocks (sequence) or labelled decision
   branches (flowchart), only for the paths that matter.

Title it after the operation: `Checkout flow`, `Login sequence`.

## Data model ("draw the schema", "show the data model")

1. Find the source of truth: SQL migrations or schema files, ORM models (Prisma, Django,
   SQLAlchemy, TypeORM, ActiveRecord, Entity Framework), GraphQL or protobuf schemas,
   or the main domain types.
2. Collect entities, their key fields (primary keys, foreign keys and a few defining
   columns, not every column) and the relationships with cardinality.
3. Draw a Mermaid `erDiagram` for databases, or a `classDiagram` for in-memory domain types
   with methods.

Title it `<Project> data model`.
