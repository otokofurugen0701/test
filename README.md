# SmartGomi MVP Management System

SmartGomiの「床を測る」ための簡易MVP管理システムです。  
無人運用前提で、以下を最優先に設計しています。

- 稼働率の可視化
- 解錠回数（利用回数）の正確な記録
- 改ざん検知しやすい監査ログ

## 実装済みスコープ (Phase 1相当)

- デバイス登録（ID/シリアル/設置先/FW/APIキー）
- キャンペーンQR LP (`/q/{campaign_token}`)
- LPからの解錠要求 (`POST /q/{campaign_token}/unlock`)
- 管理者からの遠隔解錠 (`POST /admin/unlock`)
- デバイス心拍 (`POST /device/heartbeat`)
- デバイス解錠結果 (`POST /device/unlock_result`)
- イベントログ記録
  - `qr_view`
  - `unlock_request`
  - `unlock_success`
  - `unlock_fail`
  - `heartbeat`
- 監査ログ拡張（actor/ip/user_agent/meta + ハッシュチェーン）
- 例外時の共通エラーハンドリング（APIはJSON、画面はエラーページ）
- SQLiteロック耐性設定（busy_timeout / WAL）
- 管理画面
  - ダッシュボード
  - 拠点一覧
  - 拠点詳細（時間帯別解錠、エラーログ、今すぐ解錠、QR URL）
  - ログ検索 + CSV出力
  - 巡回チェックリスト表示

## 技術スタック

- Python 3.12
- Flask 3.1
- SQLite3 (組み込み)

## セットアップ

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

起動後:

- 管理画面: `http://localhost:8000/admin/login`
- ヘルスチェック: `http://localhost:8000/health`

## 初期データ

初回起動時に自動で以下を作成します。

- 初期Adminユーザー
- サンプル拠点
- サンプルデバイス
- サンプルキャンペーン

環境変数で上書き可能:

- `DEFAULT_ADMIN_USERNAME` (default: `admin`)
- `DEFAULT_ADMIN_PASSWORD` (default: `admin1234`)
- `DB_PATH` (default: `smartgomi.db`)
- `FLASK_SECRET_KEY`
- `OFFLINE_THRESHOLD_MINUTES` (default: `10`)
- `ALERT_THRESHOLD_MINUTES` (default: `30`)
- `HEARTBEAT_EXPECTED_SECONDS` (default: `60`)
- `HEARTBEAT_GRACE_SECONDS` (default: `120`)

## APIサンプル

### 1) Heartbeat

```bash
curl -X POST http://localhost:8000/device/heartbeat \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: <device_api_key>" \
  -d '{
    "request_id": "hb-001",
    "online": true,
    "fw_version": "0.1.0",
    "voltage": 12.1,
    "rssi": -63
  }'
```

### 2) Unlock result from device

```bash
curl -X POST http://localhost:8000/device/unlock_result \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: <device_api_key>" \
  -d '{
    "request_id": "res-001",
    "command_request_id": "req-abc",
    "success": true,
    "open_seconds": 6
  }'
```

## 監査性と不正耐性 (MVP最小)

- デバイスAPIは `X-Device-Key` 必須
- 解錠操作はキャンペーントークン/管理者セッション必須
- `request_id` による冪等性管理
- クールダウン/セッション連打のレート制限
- イベントログにハッシュチェーン (`prev_hash`, `event_hash`) を保持

## 運用固定値（不足情報はシステム側で仮固定）

「非エンジニアでも回せる」ことを優先して、以下は安全側のデフォルトを採用しています。

- 解錠秒数: 6秒（許容3〜10秒）
- 連続解錠クールダウン: 20秒
- オフライン閾値: 10分（警戒30分）
- heartbeat想定間隔: 60秒（猶予120秒）
- API冪等性キー（`request_id`）最大長: 128

必要になった時点で、管理画面から変更できる設定画面を追加できます。

## 制約と今後

- 現在は1プロセス構成（SQLite）です。高負荷時はRDBMS移行を想定。
- 通知（Slack/LINE/メール）は未実装（拡張ポイントあり）。
- 決済連携（PayPay/Suica）は未実装（次フェーズ前提）。
