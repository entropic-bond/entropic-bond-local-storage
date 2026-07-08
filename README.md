# @entropic-bond/local-storage

> LocalStorage DataSource plugin for Entropic Bond

Provides a `LocalStorageDataSource` that implements the `DataSource` abstract class using the browser's `localStorage` API.

## Installation

```bash
npm install @entropic-bond/local-storage
```

## Usage

```ts
import { Store } from 'entropic-bond'
import { LocalStorageDataSource } from '@entropic-bond/local-storage'

Store.useDataSource( new LocalStorageDataSource() )
```

You can seed initial data via the constructor:

```ts
Store.useDataSource( new LocalStorageDataSource({
  users: {
    'user-1': { id: 'user-1', name: 'Alice', age: 30 },
    'user-2': { id: 'user-2', name: 'Bob', age: 25 },
  }
}) )
```

## Supported Query Operators

| Operator | Description |
|----------|-------------|
| `==`     | Equal       |
| `!=`     | Not equal   |
| `<`      | Less than   |
| `<=`     | Less than or equal |
| `>`      | Greater than |
| `>=`     | Greater than or equal |
| `contains` | Array contains |
| `containsAny` | Array contains any |

## License

ISC
