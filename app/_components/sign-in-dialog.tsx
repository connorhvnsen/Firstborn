"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { signInWithApple, signInWithGoogle } from "@/app/login/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SignInDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 rounded-lg border-stone-200 bg-stone-50 p-8 shadow-lg">
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl font-light tracking-wide text-stone-900">
            Sign in to generate
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-stone-500">
            Sign in to claim your 3 free generations and save your work.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 w-full space-y-3">
          <form action={signInWithGoogle}>
            <Button
              type="submit"
              variant="outline"
              className="flex h-auto w-full items-center justify-center gap-3 rounded-md border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-800"
            >
              <GoogleIcon />
              Continue with Google
            </Button>
          </form>

          <form action={signInWithApple}>
            <Button
              type="submit"
              className="flex h-auto w-full items-center justify-center gap-3 rounded-md border border-stone-900 bg-stone-900 px-4 py-3 text-sm font-medium text-stone-50 shadow-sm transition-colors hover:bg-black"
            >
              <AppleIcon />
              Continue with Apple
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-stone-400">
          We only use your email to identify your account.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      width="16"
      height="18"
      viewBox="0 0 16 18"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M13.36 9.55c-.02-2.16 1.77-3.2 1.85-3.25-1.01-1.47-2.58-1.67-3.14-1.7-1.34-.13-2.61.79-3.29.79-.68 0-1.73-.77-2.84-.75-1.46.02-2.81.85-3.56 2.16-1.52 2.63-.39 6.51 1.09 8.65.72 1.05 1.58 2.22 2.71 2.18 1.09-.04 1.5-.7 2.82-.7 1.31 0 1.69.7 2.84.68 1.17-.02 1.92-1.06 2.64-2.11.83-1.21 1.17-2.39 1.19-2.45-.03-.01-2.29-.88-2.31-3.5zM11.2 3.16c.6-.73 1-1.74.89-2.74-.86.04-1.9.57-2.52 1.3-.55.65-1.04 1.68-.91 2.66.96.07 1.94-.49 2.54-1.22z" />
    </svg>
  );
}
