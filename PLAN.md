# CI/CD Setup Plan

詳細は [TODO.md](./TODO.md) を参照。

## 現状

- ✅ Runner 稼働中、ワークフロー修正済み
- ✅ 手動デプロイテスト成功（HTTP 200）
- ✅ redeploy 切り替えテスト成功（8秒復旧）
- ✅ OPENAI_BASE_URL 接続確認（HTTP 200）
- ✅ Runner 自動起動確認（systemd enabled）
- ✅ ディスク使用量確認（41% / 8.4GB 空き）
- 🔄 main push での deploy.yml 自動トリガー確認待ち

## 次のステップ

1. `deploy.yml` の main push 自動実行確認（トリガー用コミット or workflow_dispatch）
2. 運用体制完了 → CI/CD セットアップ完了
