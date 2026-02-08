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
- Device Map: Mapbox GL（`NEXT_PUBLIC_MAPBOX_TOKEN` が設定されている場合に表示）

## セットアップ

### 1) 環境変数

```bash
cp .env.example .env
```

`.env` を編集し、PostgreSQL と NextAuth を設定します。  
Prisma のマイグレーション用に `SHADOW_DATABASE_URL` も必要です。

### 2) PostgreSQL（Docker 推奨）

Docker が使える場合は以下でDBを起動できます。

```bash
npm run db:up
```

初回起動時に `smagomi` と `smagomi_shadow` が作成されます。  
停止・削除は以下です。

```bash
npm run db:down
```

### 3) 依存関係

```bash
npm install
```

### 4) マイグレーション & シード

```bash
npx prisma migrate dev --name init
npm run seed
```

### 5) 起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。  
リモート環境の場合はポートフォワード先のURLを利用してください。

### 常駐起動（PM2）

開発用に常駐させたい場合は PM2 を利用できます。

```bash
npm run pm2:dev
```

ログ確認:
```bash
npm run pm2:logs
```

停止:
```bash
npm run pm2:stop
```

本番相当で起動する場合はビルド後に:
```bash
npm run build
npm run pm2:prod
```

### 自動起動スクリプト（開発用）

DB起動 → migrate → seed → PM2起動 を一括で実行します。

```bash
npm run bootstrap:dev
```

### 自動起動スクリプト（本番用）

DB起動 → migrate deploy → build → PM2起動 を一括で実行します。

```bash
npm run bootstrap:prod
```

### systemd で自動起動（推奨）

PM2 で起動したプロセスを systemd で自動起動させる場合は、
`deploy/systemd/smagomi.service` を利用できます。

```bash
# 1) PM2 起動（初回のみ）
npm run pm2:dev
pm2 save

# 2) systemd unit を配置
sudo cp deploy/systemd/smagomi.service /etc/systemd/system/smagomi.service

# 3) ユーザー名/作業ディレクトリを環境に合わせて修正
sudo sed -i "s/User=ubuntu/User=<your-user>/" /etc/systemd/system/smagomi.service
sudo sed -i "s#WorkingDirectory=/workspace#WorkingDirectory=<your-path>#" /etc/systemd/system/smagomi.service

# 4) 有効化
sudo systemctl daemon-reload
sudo systemctl enable --now smagomi

# ステータス確認
sudo systemctl status smagomi
```

### systemd（本番モード）

本番用は `smagomi-prod.service` を利用します。

```bash
# 1) ビルドして PM2 で本番起動
npm run build
npm run pm2:prod
pm2 save

# 2) systemd unit を配置
sudo cp deploy/systemd/smagomi-prod.service /etc/systemd/system/smagomi-prod.service

# 3) ユーザー名/作業ディレクトリを環境に合わせて修正
sudo sed -i "s/User=ubuntu/User=<your-user>/" /etc/systemd/system/smagomi-prod.service
sudo sed -i "s#WorkingDirectory=/workspace#WorkingDirectory=<your-path>#" /etc/systemd/system/smagomi-prod.service

# 4) 有効化
sudo systemctl daemon-reload
sudo systemctl enable --now smagomi-prod

# ステータス確認
sudo systemctl status smagomi-prod
```

### Nginx リバースプロキシ + HTTPS（Let's Encrypt）

1) Nginx と Certbot をインストールします。
```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

2) Nginx 設定を配置し、ドメインを差し替えます。
```bash
sudo cp deploy/nginx/smagomi.conf /etc/nginx/sites-available/smagomi.conf
sudo sed -i "s/smagomi.example.com/<your-domain>/" /etc/nginx/sites-available/smagomi.conf
sudo ln -s /etc/nginx/sites-available/smagomi.conf /etc/nginx/sites-enabled/smagomi.conf
sudo nginx -t
sudo systemctl reload nginx
```

3) 証明書を発行します。
```bash
sudo certbot --nginx -d <your-domain>
```

4) 80/443 が開いていることを確認してください。

> 証明書発行前に 443 ブロックがエラーになる場合は、一時的に 443 の server ブロックをコメントアウトしてください。

### Nginx 運用強化版（HSTS / Rate Limit / セキュリティヘッダ）

より堅牢な設定を使う場合は `smagomi-hardening.conf` を利用します。

```bash
sudo cp deploy/nginx/smagomi-hardening.conf /etc/nginx/sites-available/smagomi.conf
sudo sed -i "s/smagomi.example.com/<your-domain>/" /etc/nginx/sites-available/smagomi.conf
sudo nginx -t
sudo systemctl reload nginx
```

Rate limit や同時接続数は環境に合わせて調整してください。

### Nginx WAF相当ルール + JSONログ

簡易WAFルールとJSON形式のアクセスログを有効にする場合は
`smagomi-waf.conf` を利用します。

```bash
sudo cp deploy/nginx/smagomi-waf.conf /etc/nginx/sites-available/smagomi.conf
sudo sed -i "s/smagomi.example.com/<your-domain>/" /etc/nginx/sites-available/smagomi.conf
sudo nginx -t
sudo systemctl reload nginx
```

JSONログは以下に出力されます。
- `/var/log/nginx/smagomi-access.json`
- `/var/log/nginx/smagomi-error.log`

### Fail2ban 連携（簡易WAF）

Nginx の JSONログ（`smagomi-access.json`）を使って
403/405/400 を一定回数超えたIPをブロックします。

```bash
sudo apt-get install -y fail2ban
sudo cp deploy/fail2ban/filter.d/nginx-smagomi.conf /etc/fail2ban/filter.d/nginx-smagomi.conf
sudo cp deploy/fail2ban/jail.local /etc/fail2ban/jail.d/nginx-smagomi.local
sudo systemctl restart fail2ban
sudo fail2ban-client status nginx-smagomi
```

> 監視対象のログは `smagomi-waf.conf` を使っている場合のみ出力されます。

### ログ収集（Vector）

Vector を使って JSONログをパースし、別ファイルへ整形保存します。

```bash
curl -1sLf https://setup.vector.dev | sudo -E bash
sudo apt-get install -y vector
sudo mkdir -p /var/log/vector
sudo cp deploy/vector/vector.toml /etc/vector/vector.toml
sudo cp deploy/systemd/vector.service /etc/systemd/system/vector.service
sudo systemctl daemon-reload
sudo systemctl enable --now vector
sudo systemctl status vector
```

出力先: `/var/log/vector/smagomi-access.ndjson`

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

## サイトテンプレート上書き（curl例）

```bash
curl -X PATCH "http://localhost:3000/api/sites/<siteId>" \
  -H "Content-Type: application/json" \
  -d '{
    "taskTemplatesJson": [
      { "id": "collect", "label": "回収", "type": "COLLECTION", "dueOffsetDays": 1, "notes": "翌日回収" }
    ],
    "alertTemplatesJson": [
      { "id": "full", "label": "満杯", "type": "FULL", "severity": "HIGH", "notes": "満杯対応" }
    ]
  }'
```

## オフライン同期（cron 例）

オフライン判定は定期的に実行することで常に最新化できます。

```bash
curl -X POST "http://localhost:3000/api/cron/offline-sync" \
  -H "x-api-key: smagomi-cron-key"
```

## 備考

- オフライン判定は `Settings` で変更可能です（デフォルト30分）。
- サイト/デバイス単位の上書きは編集画面から設定できます。
- タスク/アラートのテンプレートは Settings でGUI/JSON編集・インポート/エクスポート・テスト送信できます。
- サイト単位のテンプレート上書きは Sites の編集画面から設定できます。
- 管理画面APIは NextAuth による認証必須です。
