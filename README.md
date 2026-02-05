# スマゴミ運用ダッシュボード（MVP）

IoTゴミ箱（スマゴミ）の状態監視・アラート・タスク管理を行う運用向けダッシュボードです。  
Next.js (App Router) + Prisma + PostgreSQL + NextAuth (Credentials) 構成で、MVPを最短で動かせる形にしています。

## 技術スタック

- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS
- Backend: Next.js Route Handlers (API)
- DB: PostgreSQL
- ORM: Prisma
- Auth: NextAuth (Credentials)
- Charts: Recharts
- Map: Mapbox Static API（`MAPBOX_TOKEN` が設定されている場合に表示）

## セットアップ

### 1) 環境変数

```bash
cp .env.example .env
```

`.env` を編集し、PostgreSQL と NextAuth を設定します。

### 2) 依存関係

```bash
npm install
```

### 3) マイグレーション & シード

```bash
npx prisma migrate dev --name init
npm run seed
```

### 4) 起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

## 初期ログイン情報（seed）

- 管理者: `admin@smagomi.local` / `password123`
- オペレーター: `operator@smagomi.local` / `password123`

## テレメトリ投入（curl例）

```bash
curl -X POST "http://localhost:3000/api/telemetry/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: smagomi-demo-key" \
  -d '{
    "deviceCode": "SMG-0001",
    "ts": "2026-02-05T12:00:00Z",
    "fill_level_pct": 90,
    "battery_pct": 55,
    "door_open": false,
    "temp_c": 23.5,
    "rssi": -66
  }'
```

> `deviceCode` は seed データの `SMG-0001 / SMG-0002` を利用できます。

## 備考

- オフライン判定は `Settings` で変更可能です（デフォルト30分）。
- 管理画面APIは NextAuth による認証必須です。
