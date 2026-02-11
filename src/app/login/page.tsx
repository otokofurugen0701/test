import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">スマゴミ運用ダッシュボード</h1>
        <p className="mt-2 text-sm text-slate-600">管理者/オペレーター用ログイン</p>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-slate-500">読み込み中...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
