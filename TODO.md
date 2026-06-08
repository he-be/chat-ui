# CI/CD Setup - 全体像と進捗

## 目標

`ssh root@chat-ui` (Tailscale) でアクセスできる LXC に GitHub Self-hosted Runner + Docker を設定し、main ブランチ push で自動ビルド・デプロイする。

## 環境

| 項目         | 値                                                       |
| ------------ | -------------------------------------------------------- |
| LXC          | Ubuntu 24.04, 2 vCPU (Ryzen 7 5700X), 4GB RAM, 15GB disk |
| ネットワーク | LAN 直接 10MB/s + Tailscale (SSHのみ)                    |
| Docker       | 29.5.3 + compose + buildx                                |
| リポジトリ   | github.com/he-be/chat-ui                                 |

---

## ✅ 完了

### 1. LXC 環境構築

- [x] Docker 29.5.3 インストール + 起動
- [x] docker-compose-plugin, buildx-plugin インストール
- [x] SSH キー生成 + GitHub Deploy Key 登録
- [x] リポジトリクローン (`/opt/chat-ui`)
- [x] `.env.local` 配置（開発環境からコピー）

### 2. GitHub Self-hosted Runner

- [x] Runner v2.334.0 ダウンロード (`/opt/runner`)
- [x] `runner` ユーザー作成 + リポジトリ接続
- [x] systemd サービス化 (`actions.runner.he-be-chat-ui.chat-ui-runner.service`)
- [x] `docker` グループ追加（runner ユーザーが Docker 操作可能に）
- [x] 稼働確認（`Listening for Jobs`）

### 3. ワークフロー修正

- [x] `lint-and-test.yml`: `build-check` の `runs-on` を `self-hosted` に変更
- [x] `build-image.yml`: GHCR 公開を `workflow_dispatch` -only に無効化
- [x] `deploy.yml` 新規作成（docker-compose + mongo:7 + chat-ui）
- [x] クリーンアップ処理追加（`docker builder prune` + `docker image prune`）

### 4. アプリ起動テスト

- [x] MongoDB in-memory サーバーの Node.js 24 互換性問題を発見（`__dirname is not defined`）
- [x] 外部 MongoDB (mongo:7) に切り替え
- [x] `docker-compose.deploy.yml` 作成
- [x] 手動起動テスト成功（HTTP 200 確認）

### 5. パフォーマンス計測

- [x] ネットワーク速度: 10MB/s（問題なし）
- [x] フルクリーンビルド: 162秒（2分42秒）
- [x] ボトルネック分析: vite build (50秒, CPU律速) が最大

---

## 🔄 未完了 / 要対応

### 6. CI/CD 自動デプロイの完全動作確認

- [ ] `deploy.yml` ワークフローの完全成功確認（main push での自動トリガー）
- [x] デプロイ後のアプリ動作確認（healthcheck OK, モデル API 正常）
- [x] 再デプロイ時のスムーズな切り替え確認（`--force-recreate` テスト成功, 8秒で復旧）

### 7. 運用体制

- [x] Runner の自動再起動確認（systemd `enabled`, 稼働中）
- [x] ディスク使用量の監視（41% / 8.4GB 空き — 当面問題なし）
- [x] `OPENAI_BASE_URL` の接続確認（`192.168.0.199:8080` → HTTP 200 正常）

### 8. オプション改善

- [ ] CPU 2→4 増設検討（ビルド 20秒短縮効果）
- [ ] `OPENAI_BASE_URL` を Tailscale IP またはホスト名に変更検討
- [ ] デプロイ失敗時のロールバック手順整備
- [ ] `feat/search-tool-strategy` ブランチの merge

---

## 現在のLXC状態

```
Docker コンテナ:
  ├─ chat-ui (chat-ui:latest) - 稼働中, :3000
  └─ chat-ui-mongo (mongo:7)  - 稼働中, :27017

ディスク: 15GB / 使用 5.6GB (41%) / 空き 8.4GB
  ├─ Docker イメージ: ~2.5GB (chat-ui + mongo)
  ├─ Docker volumes: ~300MB (MongoDB データ)
  └─ その他: ~2.8GB (システム + runner + ソース)

ファイル構成:
  /opt/chat-ui/         - リポジトリ + .env.local + docker-compose.deploy.yml
  /opt/chat-ui/db/      - (未使用、外部MongoDBに移行)
  /opt/runner/          - GitHub Actions Runner
```
