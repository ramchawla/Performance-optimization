import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="font-display text-2xl font-bold text-fg">Performance Hub</h1>
        <SignInForm />
      </div>
    </main>
  );
}
